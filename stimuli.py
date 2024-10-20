# %%
import json
import random
from itertools import product

N_TASK = 5

def separate_shapes(shape_def):
    # Split the string into rows
    rows = shape_def.strip().split('\n')
    
    # Find all shapes
    shapes = []
    for start_y in range(1, len(rows), 6):
        shape = [row[1:8] for row in rows[start_y:start_y+5]]
        shapes.append(shape)
    
    # Separate 1s and 2s for each shape
    result = []
    for shape in shapes:
        shape_1 = [''.join(['1' if c == '1' else '_' for c in row]) for row in shape]
        shape_2 = [''.join(['2' if c == '2' else '_' for c in row]) for row in shape]
        result.extend(['\n'.join(shape_1), '\n'.join(shape_2)])
    
    return result

def parse_shape_definition():
    with open('shape_definition.txt', 'r') as file:
        shape_definition = file.read()

    separated_shapes = separate_shapes(shape_definition)

    # Separate shapes into lists for 1s and 2s
    left_shapes = separated_shapes[::2]  # Every even-indexed shape (0, 2, 4, ...)
    right_shapes = separated_shapes[1::2]  # Every odd-indexed shape (1, 3, 5, ...)

    return {'left': left_shapes, 'right': right_shapes}


class TaskCodeGenerator:
    def __init__(self, max_digit, code_length, n_part, solutions_per_task):
        self.max_digit = max_digit
        self.code_length = code_length
        self.n_part = n_part
        self.solutions_per_task = solutions_per_task
        self.available_codes = []
        self.compositional_codes = {}
        self.used_codes = set()
        
    def generate(self):
        self.tasks = list(product(range(self.n_part), repeat=2))
        self._generate_all_codes()
        self.task_code_mapping = {}
        self._generate_part_codes()

        self.compositional_codes = {f"{i+1}{j+1}": self.left_codes[i] + self.right_codes[j] for i, j in self.tasks}
        self.used_codes |= set(self.compositional_codes.values())
        self._generate_bespoke_codes()
        self._validate_task_code_mapping()
        return self.task_code_mapping

    def _generate_part_codes(self):
        part_codes = self._generate_unique_codes(self.max_digit, 2)
        self.left_codes = part_codes[:self.n_part]
        self.right_codes = part_codes[self.n_part:2 * self.n_part+1]

    def _generate_tasks(self):
        self.tasks = list(product(range(self.n_part), repeat=2))

    def _generate_all_codes(self):
        self.available_codes = self._generate_unique_codes(self.max_digit, self.code_length)
        random.shuffle(self.available_codes)
        self.used_codes = set(self.compositional_codes.values())

    def _generate_bespoke_codes(self):
        for task, comp_code in self.compositional_codes.items():
            task_codes = {comp_code: "compositional"}
            
            for _ in range(self.solutions_per_task - 1):
                bespoke_code = self._generate_bespoke_code(comp_code)
                task_codes[bespoke_code] = "bespoke"
                self.used_codes.add(bespoke_code)

            self.task_code_mapping[task] = task_codes

    def _generate_unique_codes(self, max_digit, code_length):
        all_possible_codes = [''.join(digits) for digits in product(map(str, range(1, max_digit + 1)), repeat=code_length)]
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

task_code_mapping = TaskCodeGenerator(max_digit=5, code_length=4, n_part=4, solutions_per_task=10).generate()
parts = parse_shape_definition()

trials = []
for (task, solutions) in random.sample(list(task_code_mapping.items()), N_TASK):
    blockString = compose_block_strings(parts['left'][int(task[0])-1], parts['right'][int(task[1])-1])
    trials.append({
        'task': task,
        'solutions': solutions,
        'blockString': blockString
    })


def make_bespoke(blockString):
    return blockString.replace('1', '3').replace('2', '3')

N_MANUAL = 16
def generate_manual():
    manual = []
    for task, solutions in random.sample(list(task_code_mapping.items()), N_MANUAL):
        blockString = compose_block_strings(parts['left'][int(task[0])-1], parts['right'][int(task[1])-1])
        code = list(task_code_mapping[task].keys())[random.choice((0, 1))]
        compositional = task_code_mapping[task][code] == 'compositional'
        if not compositional:
            blockString = make_bespoke(blockString)

        manual.append({
            'task': task,
            'compositional': compositional,
            'blockString': blockString,
            'code': code
        })
    return manual

config = {
    'trials': trials,
    'manual': generate_manual()
}

json.dump(config, open('static/json/config.json', 'w'))
print('wrote config.json')

# Pretty print one trial and the first entry of the manual
import pprint

print("Sample Trial:")
pprint.pprint(trials[0], width=80, indent=2)

print("\nFirst Manual Entry:")
pprint.pprint(config['manual'][0], width=80, indent=2)

