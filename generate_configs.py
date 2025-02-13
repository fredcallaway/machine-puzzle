import os
import random
import json
import itertools

from stimuli import Stimuli, Shapes, Codes

N_TASK = 10
MAX_DIGIT = 9
CODE_LENGTH = 4
N_MANUAL = 8
CONFIG_DIR = 'static/json/code-pilot'
N_CONFIG = 1
MAIN_SHAPES = 'stimuli/5keys.json'  # keys
INSTRUCT_SHAPES = 'stimuli/instruct4.json'
PARAMS = {
    'width': 6,
    'height': 5
}

class IterSampler:
    def __init__(self, options):
        self.options = list(options)
        self.excluded = set()
        random.shuffle(self.options)
        self.index = 0
    
    def remove(self, obj):
        self.excluded.add(obj)

    def next(self, condition=lambda x: True):          
        start_index = self.index
        while True:
            if self.index >= len(self.options):
                self.index = 0
                random.shuffle(self.options)
                
            option = self.options[self.index]
            self.index += 1
            
            if option not in self.excluded and condition(option):
                return option
                
            if self.index == start_index:
                raise ValueError("No valid options remain")

    def __iter__(self):
        while True:
            yield self.next()

    def iter(self, condition=lambda x: True):
        while True:
            yield self.next(condition)


def shuffled(x):
    y = list(x)
    random.shuffle(y)
    return y


class InformativeTrials:
    def __init__(self, shapes, max_digit, code_length):
        self.shapes = shapes
        self.max_digit = max_digit
        self.code_length = code_length
        self.tasks = [f"{i+1}{j+1}" for i, j in itertools.product(range(self.shapes.n_part), repeat=2)]
        self.half_tasks = ''.join([f"{i+1}" for i in range(self.shapes.n_part)])

    def generate(self):
        trial_types = shuffled(itertools.product(
            ['available', 'unavailable'], 
            ['exact', 'full', 'partial', 'none']
        ))
        n_decoys = shuffled(range(6, 6 + 2 * 8, 2))
        # all_tasks = shuffled(self.tasks)
        # decoy_tasks = all_tasks[len(trial_types):]

        picknot = lambda x: random.choice(self.half_tasks.replace(x, ''))
        trials = []
        
        for (besp, comp), n_decoys in zip(trial_types, n_decoys):
            task = random.choice(self.tasks)
            manual = []
            a,b = task
            if besp == 'available':
                manual.append((task, 'bespoke'))
            if comp == 'exact':
                manual.append((task, 'compositional'))
            elif comp == 'full':
                manual.append((a+picknot(b), 'compositional'))
                manual.append((picknot(a)+b, 'compositional'))
            elif comp == 'partial':
                if random.random() < .5:
                    manual.append((a+picknot(b), 'compositional'))
                else:
                    manual.append((picknot(a)+b, 'compositional'))
            
            assert self._check_conditions(manual, task, comp, besp)

            for _ in range(n_decoys):
                for i in range(1000):
                    # add one decoy
                    manual.append((random.choice(self.tasks), random.choice(['bespoke', 'compositional'])))
                    if self._check_conditions(manual, task, comp, besp):
                        break
                    else:
                        manual.pop()
                else:
                    import ipdb; ipdb.set_trace()
                    raise ValueError(f'failed to find a valid trial of type {besp}-{comp}')
            
            random.shuffle(manual)
            codes = Codes(self.max_digit, self.code_length)
            trials.append(Stimuli(self.shapes, codes).trial(task, manual))
        
        random.shuffle(trials)
        return trials
    
    def _check_conditions(self, manual, task, target_comp, target_besp):
        besp = 'available' if (task, 'bespoke') in manual else 'unavailable'
        if besp != target_besp:
            return False

        exact = (task, 'compositional') in manual
        if exact:
            return target_comp == 'exact'
        
        left = any(a == task[0] and kind == 'compositional' for (a, b), kind in manual)
        right = any(b == task[1] and kind == 'compositional' for (a, b), kind in manual)
        if left and right:
            return target_comp == 'full'
        elif left or right:
            return target_comp == 'partial'
        else:
            return target_comp == 'none'        

def generate_config(i):
    random.seed(i)
    shapes = Shapes(MAIN_SHAPES)
    trials = InformativeTrials(shapes, MAX_DIGIT, CODE_LENGTH).generate()
    return {
        'trials': list(trials),
        # 'trials': [stimuli.trial(**t) for t in trials],
        'params': {
            'maxDigit': MAX_DIGIT,
            'codeLength': CODE_LENGTH,
        },
        'instructions': Stimuli(
            Shapes(INSTRUCT_SHAPES), 
            Codes(MAX_DIGIT, CODE_LENGTH)
        ).wrapper_params()
    }

def test():
    shapes = Shapes(MAIN_SHAPES)
    gen = InformativeTrials(shapes, MAX_DIGIT, CODE_LENGTH)
    assert gen._check_conditions([('12', 'compositional'), ('21', 'compositional')], '22', 'full', 'unavailable')


if __name__ == '__main__':

    os.makedirs(CONFIG_DIR, exist_ok=True)
    for i in range(N_CONFIG):
        config = generate_config(i)
        json.dump(config, open(f'{CONFIG_DIR}/{i}.json', 'w'))
        # print(f'wrote {CONFIG_DIR}/{i}.json')

        print(f'wrote {N_CONFIG} configs to {CONFIG_DIR}')

