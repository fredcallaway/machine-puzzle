#!/usr/bin/env python3
import subprocess
import os
import re
import pandas as pd

def bash(cmd, background=False):
    if background:
        os.system(cmd + ' &')
    else:
        status, output = subprocess.getstatusoutput(cmd)
        if status != 0:
            print("Problem with command:", cmd)
            print(output)
            raise Exception()
        return output

with open('config.txt') as f:
    config = f.read()

codeversion = re.search(r'experiment_code_version = (.*)', config).group(1)
prev_gen = int(codeversion.split('g')[1])
next_gen = prev_gen + 1

if prev_gen != 0:
    print('fetch data')
    out = bash('bin/fetch_data.py')
    pdf = pd.read_csv(f'data/raw/{codeversion}/participants.csv')
    counts = pdf.query('complete').groupby(['pop_name', 'N']).complete.count()
    if not len(counts.to_frame().query('complete >= N')) == len(counts):
        print('Not enough participants')
        print(counts)
    os.system('bin/prolific.py approve_all 3 &')

print('generate stimuli')
bash(f'cd ../compositionality-model && jl generate_redblack.jl {next_gen}' )

print('update code version')
next_code = codeversion.split('g')[0] + 'g' + str(next_gen)
with open('config.txt', 'w') as f:
    f.write(config.replace(codeversion, next_code))

# update heroku
print('update heroku')
bash('git add config.txt')
bash('git add static/json')
bash(f'git commit -m "{next_code}"')
bash('git push heroku master')


pdf


if prev_gen == 0:
    print(bash("bin/prolific.py post_duplicate --no_check"))
else:
    for pop_name in pdf.pop_name.unique():
        cmd = f'bin/prolific.py post_duplicate --url_params "config_dir={pop_name}-1" --internal_name {next_code}-{pop_name} --no_check'
        print(cmd)
        bash(cmd, background=True)