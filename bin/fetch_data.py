#!env/bin/python

import os
import subprocess
import logging
import requests
from requests.auth import HTTPBasicAuth
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter
import hashlib
import json

# set environment parameters so that we use the remote database

def get_database():
    if os.path.isfile('.database_url'):
        with open('.database_url') as f:
            return f.read()
    else:
        cmd = "heroku config:get DATABASE_URL"
        url = subprocess.check_output(cmd, shell=True).strip().decode('ascii')
        with open('.database_url', 'w') as f:
            f.write(url)
            return url


class Anonymizer(object):
    def __init__(self, enabled=True):
        self.mapping = {}
        self.enabled = enabled

    def __call__(self, worker_id):
        if not self.enabled or 'debug' in worker_id:
            return worker_id

        if worker_id not in self.mapping:
            # self.mapping[worker_id] = 'w' + hashlib.md5(worker_id.encode()).hexdigest()[:7]
            self.mapping[worker_id] = 'w' + worker_id[-8:]
        return self.mapping[worker_id]

def pick(obj, keys):
    return {k: obj.get(k, None) for k in keys}

import csv
def write_csv(file, records):
    with open(file, mode='w', newline='') as file:
        fieldnames = records[0].keys()
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            writer.writerow(record)

def write_data(version, mode):
    anonymize = Anonymizer(enabled = mode == 'live')

    if mode != 'local':
        env = os.environ
        env["PORT"] = ""
        env["ON_CLOUD"] = "1"
        env["DATABASE_URL"] = get_database()
        # what should go here??

    from psiturk.models import Participant  # must be imported after setting env params
    ps = Participant.query.filter(Participant.codeversion == version).all()

    if mode == 'live':
        ps = [p for p in ps
            if 'debug' not in p.uniqueid
            and not p.workerid.startswith('601055')  # the "preview" participant
            and p.mode == 'live'
        ]
    # Note: we don't filter by completion status.

    metakeys = ['condition', 'useragent']
    participants = []

    os.makedirs(f'data/raw/{version}/events/', exist_ok=True)
    for p in ps:
        if p.datastring is None:
            continue
        datastring = json.loads(p.datastring)

        trialdata = [d['trialdata'] for d in datastring['data']]
        try:
            params = next(e for e in trialdata if e['event'] == 'experiment.initialize')["PARAMS"]
        except StopIteration:
            continue

        meta = pick(datastring, metakeys)
        meta['workerid'] = p.workerid
        meta['wid'] = wid = anonymize(p.workerid)
        meta['start_time'] = p.beginhit

        meta['active_minutes'] = (datastring['data'][-1]['dateTime'] - datastring['data'][0]['dateTime']) / 60000

        

        # meta.update(pick(params, ['pop_name', 'M', 'N', 'K']))

        participants.append(meta)
        meta['complete'] = any(e['event'] == "experiment.complete" for e in trialdata)

        with open(f'data/raw/{version}/events/{wid}.json', 'w') as f:
            json.dump(trialdata, f)

    write_csv(f'data/raw/{version}/participants.csv', participants)

    with open(f'data/raw/{version}/identifiers.json', 'w') as f:
        json.dump(anonymize.mapping, f)

    print(len(participants), 'participants', sum(p['complete'] for p in participants), 'complete')
    print(f'data/raw/{version}/participants.csv')

if __name__ == "__main__":
    parser = ArgumentParser(
        formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument(
        "version",
        nargs="?",
        help=("Experiment version. This corresponds to the experiment_code_version "
              "parameter in the psiTurk config.txt file that was used when the "
              "data was collected."))
    parser.add_argument("--debug", help="Keep debug participants", action="store_true")
    parser.add_argument("--local", help="Use local database (implies --debug)", action="store_true")

    args = parser.parse_args()
    mode = 'local' if args.local else 'debug' if args.debug else 'live'

    version = args.version
    if version == None:
        import configparser
        c = configparser.ConfigParser()
        c.read('config.txt')
        version = c["Task Parameters"]["experiment_code_version"]
        print("Fetching data for current version: ", version)

    write_data(version, mode)
