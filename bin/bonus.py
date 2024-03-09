#!/usr/bin/env python3
import pandas as pd
import os
from fire import Fire

def main(codeversion):
    qd = pd.read_csv(f'data/human_raw/{codeversion}/questiondata.csv', header=None)
    x = qd.loc[qd[1] == 'bonus']
    bonus = pd.DataFrame({
        'participant_id': x[0].apply(lambda x: x.split(':')[0]),
        'bonus': x[2].astype(float)
    }).set_index('participant_id').bonus

    file = f'data/human_raw/{codeversion}/bonus.csv'
    bonus.to_csv(file, index=True, header=False)
    print(len(bonus), 'participants to receive bonuses')
    print(f'mean: ${bonus.mean():.2f}  median: ${bonus.median():.2f}')

    os.system(f'cat {file} | pbcopy')
    print(f'Wrote {file} and copied contents to clipboard.')

if __name__ == '__main__':
    Fire(main)
