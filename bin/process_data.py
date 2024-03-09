#!/usr/bin/env python3
import pandas as pd
import os
from ast import literal_eval
import json
import sys
import bonus

def all_nan(col):
    try:
        return col.apply(np.isnan).all()
    except:
        return False

def drop_nan_cols(df):
    return df[[name for name, col in df.iteritems()
               if not all_nan(col)]]

def main(codeversion):
    out = f'data/processed/{codeversion}'
    os.makedirs(out, exist_ok=True)

    def load_raw(kind):
        return drop_nan_cols(pd.read_csv(f'data/human/{codeversion}/{kind}.csv'))

    pdf = load_raw('participants').set_index('wid')
    pdf.to_csv(out + 'participants.csv')

    if os.path.isdir('/Users/fred/Projects/XXXXXXX/data/'):
        os.system(f'rsync -av data/processed/{codeversion}/ /Users/fred/Projects/XXXXXXX/data/{codeversion}/')

    bonus.main(codeversion)

if __name__ == '__main__':
    main(sys.argv[1])
