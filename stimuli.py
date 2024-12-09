# %%
import json
import os
import random
from itertools import product
import numpy as np
from scipy import stats

N_TASK = 10
MAX_DIGIT = 9
CODE_LENGTH = 4
N_PART = 4
SOLUTIONS_PER_TASK = 20
N_MANUAL = 8
CONFIG_DIR = 'code-pilot'
N_CONFIG = 50
MAXTRY_QUANTILE = 0.5
MAIN_STIMULI_FILE = 'stimuli/oct31.json'
INSTRUCT_STIMULI_FILE = 'stimuli/instruct4.json'
PARAMS = {
    'width': 6,
    'height': 5
}
# %% --------

def parse_shapes(filepath):
    with open(filepath, 'r') as file:
        shapes = json.load(file)
    
    def to_block_string(shape):
        padding = shapes.get('padding', {})
        trimmed = [row[padding.get('left', 0):-padding.get('right', 0)] if padding else row for row in shape]
        return '\n'.join(''.join('1' if x == 1 else '2' if x == 2 else '_' for x in row) for row in trimmed)
    
    return {
        'left': [to_block_string(shape) for shape in shapes['left']],
        'right': [to_block_string(shape) for shape in shapes['right']]
    }

# %% --------

class TaskCodeGenerator:
    def __init__(self, max_digit=MAX_DIGIT, code_length=CODE_LENGTH, n_part=N_PART, solutions_per_task=SOLUTIONS_PER_TASK):
        self.max_digit = max_digit
        self.code_length = code_length
        self.n_part = n_part
        self.solutions_per_task = solutions_per_task
        self.available_codes = []
        self.compositional_codes = {}
        self.used_codes = set()
        self.tasks = list(product(range(self.n_part), repeat=2))
        self.task_code_mapping = {}
        
    def generate(self):
        self._generate_all_codes()
        self._generate_compositional_codes()
        self._generate_bespoke_codes()
        self._validate_task_code_mapping()
        return self.task_code_mapping

    def _generate_compositional_codes(self):
        part_codes = self._generate_unique_codes(2)
        self.left_codes = part_codes[:self.n_part]
        self.right_codes = part_codes[self.n_part:2 * self.n_part+1]
        self.compositional_codes = {f"{i+1}{j+1}": self.left_codes[i] + self.right_codes[j] for i, j in self.tasks}
        self.used_codes |= set(self.compositional_codes.values())

    def _generate_all_codes(self):
        self.available_codes = self._generate_unique_codes(self.code_length)
        random.shuffle(self.available_codes)

    def _generate_bespoke_codes(self):
        for task, comp_code in self.compositional_codes.items():
            task_codes = {comp_code: "compositional"}
            
            for _ in range(self.solutions_per_task - 1):
                bespoke_code = self._generate_bespoke_code(comp_code)
                task_codes[bespoke_code] = "bespoke"
                self.used_codes.add(bespoke_code)

            self.task_code_mapping[task] = task_codes

    def _generate_unique_codes(self, code_length):
        all_possible_codes = [''.join(digits) for digits in product(map(str, range(1, self.max_digit+1)), repeat=code_length)]
        random.shuffle(all_possible_codes)
        return all_possible_codes

    def _generate_bespoke_code(self, comp_code):
        for code in self.available_codes:
            if (code not in self.used_codes and
                code[:2] != comp_code[:2] and 
                code[-2:] != comp_code[-2:]):
                return code
        
        raise ValueError("No suitable bespoke code found among available codes.")
        
    def _validate_task_code_mapping(self):
        # Assert number of tasks
        assert len(self.task_code_mapping) == self.n_part ** 2, f"Expected {self.n_part**2} tasks, got {len(self.task_code_mapping)}"

        all_codes = set()
        for task, codes in self.task_code_mapping.items():
            # Assert task format
            assert len(task) == 2 and task.isdigit(), f"Invalid task format: {task}"
            assert 1 <= int(task[0]) <= self.n_part and 1 <= int(task[1]) <= self.n_part, f"Task out of range: {task}"

            # Assert number of solutions per task
            assert len(codes) == self.solutions_per_task, f"Task {task} has {len(codes)} solutions, expected {self.solutions_per_task}"

            # Assert code properties
            comp_code = None
            for code, code_type in codes.items():
                # Assert code format
                assert len(code) == self.code_length and code.isdigit(), f"Invalid code format: {code}"
                assert all(1 <= int(digit) <= self.max_digit for digit in code), f"Code contains digit out of range: {code}"

                # Assert code uniqueness across all tasks
                assert code not in all_codes, f"Duplicate code across tasks: {code}"
                all_codes.add(code)

                if code_type == "compositional":
                    assert comp_code is None, f"Multiple compositional codes for task {task}"
                    comp_code = code
                elif code_type == "bespoke":
                    assert comp_code is not None, f"Bespoke code before compositional for task {task}"
                    # Assert bespoke code constraints
                    assert code[:2] != comp_code[:2], f"Bespoke code {code} matches first two digits of compositional code {comp_code}"
                    assert code[-2:] != comp_code[-2:], f"Bespoke code {code} matches last two digits of compositional code {comp_code}"
                else:
                    assert False, f"Invalid code type: {code_type}"

            assert comp_code is not None, f"No compositional code for task {task}"

        # Assert total number of codes
        expected_total_codes = self.n_part ** 2 * self.solutions_per_task
        assert len(all_codes) == expected_total_codes, f"Expected {expected_total_codes} total codes, got {len(all_codes)}"

def compose_block_strings(left, right):
    if len(left) != len(right):
        raise ValueError("Left and right strings must be of equal length")
    
    result = []
    for l, r in zip(left, right):
        if l == '\n' and r == '\n':
            result.append('\n')
        elif l == '1' and r == '2':
            raise ValueError("Conflict: left is '1' and right is '2'")
        elif l == '1':
            result.append('1')
        elif r == '2':
            result.append('2')
        elif l == '_' and r == '_':
            result.append('_')
        elif l != '\n' and r != '\n':
            raise ValueError(f"Unexpected combination: left='{l}', right='{r}'")
        else:
            raise ValueError(f"Misaligned newlines: left='{l}', right='{r}'")
    
    return ''.join(result)

def make_bespoke(blockString):
    return blockString.replace('1', '3').replace('2', '3')

class RandomStimuliGenerator:
    def __init__(self, task_code_mapping, parts):
        self.task_code_mapping = task_code_mapping
        self.parts = parts

    def generate(self):
        manual = self.generate_manual()
        trials = self.generate_trials()
        return trials, manual

    def generate_manual(self, n):
        manual = []
        for task, solutions in random.sample(list(self.task_code_mapping.items()), n):
            blockString = compose_block_strings(self.parts['left'][int(task[0])-1], self.parts['right'][int(task[1])-1])
            code = list(solutions.keys())[random.choice((0, 1))]
            compositional = solutions[code] == 'compositional'
            # if not compositional:
            # blockString = make_bespoke(blockString)

            manual.append({
                'task': task,
                'compositional': compositional,
                'blockString': blockString,
                'code': code
            })
        return manual

    def generate_trials(self, n=N_TASK):
        trials = []
        # bespoke (present/absent) x compositional (exact/full/partial/none)
        for (task, solutions) in random.choices(list(self.task_code_mapping.items()), n):
            blockString = compose_block_strings(self.parts['left'][int(task[0])-1], self.parts['right'][int(task[1])-1])
            trials.append({
                'task': task,
                'solutions': solutions,
                'blockString': blockString
            })
        return trials

# %% --------
class InformativeStimuliGenerator:
    def __init__(self, task_code_mapping, parts):
        self.task_code_mapping = task_code_mapping
        self.parts = parts

    def generate(self):
        C, B, tasks = self.generate_abstract()
        trials = self.generate_trials(tasks)
        manual = self.generate_manual(C, B)
        return trials, manual

    def generate_manual(self, C, B):
        manual = []
        for tasks, compositional in [((zip(*np.where(C))), True), ((zip(*np.where(B))), False)]:
            for (i, j) in tasks:
                blockString = compose_block_strings(self.parts['left'][i], self.parts['right'][j])
                if not compositional:
                    blockString = make_bespoke(blockString)
                task = "".join(str(t+1) for t in (i, j))
                
                solutions = self.task_code_mapping[task]
                if compositional:
                    code = next(code for code, type in solutions.items() if type == 'compositional')
                else:
                    code = next(code for code, type in solutions.items() if type == 'bespoke')
                manual.append({
                    'task': task,
                    'compositional': compositional,
                    'blockString': blockString,
                    'code': code
                })
        random.shuffle(manual)
        return manual
    
    def generate_trials(self, tasks):
        trials = []
        for (i, j) in tasks:
            task = "".join(str(t+1) for t in (i, j))
            trials.append({
                'task': task,
                'solutions': self.task_code_mapping[task],
                'blockString': compose_block_strings(self.parts['left'][i], self.parts['right'][j])
            })
        return trials
    
    def generate_abstract(self):
        # three compositional solutions across 3 columns and 2 rows 
        C = np.zeros((N_PART, N_PART), dtype=bool)
        a, b, c, d = random.sample(range(4), 4)
        C[a, a] = 1
        C[a, b] = 1
        C[b, c] = 1

        # compute compostional types: none, partial, full, exact
        partial = np.logical_or.outer(C.any(1), C.any(0))
        full = np.logical_and.outer(C.any(1), C.any(0))
        types = 1 * partial + full + C

        # for each type, one matching task gets a bespoke solution
        B = np.zeros((N_PART, N_PART), dtype=bool)
        # we order the tasks by type to make sure we don't turn a none to partial or partial to full
        tasks = []
        for t in range(4):
            i, j = np.where(types == t)
            if len(i) < 2:
                raise ValueError(f"Invalid C")
            # pick two tasks at random
            idx1, idx2 = np.random.choice(len(i), 2, replace=False)
            i1, j1 = i[idx1], j[idx1]
            i2, j2 = i[idx2], j[idx2]
            # first task gets a bespoke solution
            B[i1, j1] = 1
            # random order within compositional type
            these_tasks = [(i1, j1), (i2, j2)]
            random.shuffle(these_tasks)
            tasks.extend(these_tasks)
            
        # 10s place is for bespoke
        types += 10 * B

        # make sure that we actually have all the types
        for t in [0, 1, 2, 3, 10, 11, 12, 13]:
            assert any(types[task] == t for task in tasks), f"Type {t} not present"

        return C, B, tasks


def max_try(p):
    # quantile of geometric distribution
    return stats.geom(p).ppf(.5)
    

def generate_instructions():
    with open(INSTRUCT_STIMULI_FILE, 'r') as file:
        return json.load(file)

def generate_instructions():
    parts = parse_shapes(INSTRUCT_STIMULI_FILE)
    n_part = len(parts['left'])
    task_code_mapping = TaskCodeGenerator(max_digit=4, n_part=n_part, solutions_per_task=2).generate()
    return {
        'params': {
            'width': 6,
            'height': 3,
            'maxDigit': 4
        },
        'shapes': {
            f"{i+1}{j+1}": compose_block_strings(parts['left'][i], parts['right'][j])
            for i, j in product(range(n_part), repeat=2)
        },
        'codes': {
            task: {
                "compositional": next(code for code, type in solutions.items() if type == 'compositional'),
                "bespoke": next(code for code, type in solutions.items() if type == 'bespoke')
            }
            for task, solutions in task_code_mapping.items()
        }
    }

def generate_config(i):
    random.seed(i)
    task_code_mapping = TaskCodeGenerator().generate()
    parts = parse_shapes(MAIN_STIMULI_FILE)
    trials, manual = InformativeStimuliGenerator(task_code_mapping, parts).generate()
    return {
        'trials': trials,
        'params': {
            **PARAMS,
            'maxDigit': MAX_DIGIT,
            'codeLength': CODE_LENGTH,
            'nPart': N_PART,
            'solutionsPerTask': SOLUTIONS_PER_TASK,
            'manual': manual,
            # 'nClickBespoke': max_try(SOLUTIONS_PER_TASK / (MAX_DIGIT ** CODE_LENGTH)),
            # 'nClickPartial': max_try(1 / (MAX_DIGIT ** (CODE_LENGTH/2))),
        },
        'instructions': generate_instructions()
    }

def test_config():
    random.seed(0)
    code_generator = TaskCodeGenerator(max_digit=5)
    task_code_mapping = code_generator.generate()
    parts = parse_shapes(MAIN_STIMULI_FILE)
    trials, manual = InformativeStimuliGenerator(task_code_mapping, parts).generate()
    return {
        'trials': trials,
        'params': {
            **PARAMS,
            'maxDigit': code_generator.max_digit,
            'codeLength': CODE_LENGTH,
            'nPart': N_PART,
            'solutionsPerTask': SOLUTIONS_PER_TASK,
            'manual': manual,
            'buttonDelay': 0
            # 'nClickBespoke': max_try(SOLUTIONS_PER_TASK / (MAX_DIGIT ** CODE_LENGTH)),
            # 'nClickPartial': max_try(1 / (MAX_DIGIT ** (CODE_LENGTH/2))),
        },
        'instructions': generate_instructions()
    }

json.dump(test_config(), open(f'static/json/test.json', 'w'))

# %% --------

# os.makedirs(f'static/json/{CONFIG_DIR}', exist_ok=True)
# for i in range(N_CONFIG):
#     config = generate_config(i)
#     json.dump(config, open(f'static/json/{CONFIG_DIR}/{i}.json', 'w'))
#     # print(f'wrote static/json/{CONFIG_DIR}/{i}.json')



