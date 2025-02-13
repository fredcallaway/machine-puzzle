from functools import lru_cache
import json
import random
from itertools import product


class Shapes:
    def __init__(self, filepath):
        self.shapes, (self.width, self.height) = self._parse_shapes(filepath)
        self.n_part = len(self.shapes['left'])
    
    def get(self, task, kind):
        a, b = map(lambda x: int(x)-1, task)
        if kind == 'compositional':
            return self._compose_block_strings(self.shapes['left'][a], self.shapes['right'][b])
        else:
            assert kind == 'bespoke'
            return self._make_bespoke(self._compose_block_strings(self.shapes['left'][a], self.shapes['right'][b]))
        
    
    @staticmethod
    def _parse_shapes(filepath):
        with open(filepath, 'r') as file:
            raw_shapes = json.load(file)

        def to_block_string(shape):
            padding = raw_shapes.get('padding', {})
            trimmed = [row[padding.get('left', 0):-padding.get('right', 0)] if padding else row for row in shape]
            return '\n'.join(''.join('1' if x == 1 else '2' if x == 2 else '_' for x in row) for row in trimmed)
        shapes = {
            'left': [to_block_string(shape) for shape in raw_shapes['left']],
            'right': [to_block_string(shape) for shape in raw_shapes['right']]
        }
        size = (len(raw_shapes['left'][0][0]), len(raw_shapes['left'][0]))
        return shapes, size

    @staticmethod
    def _compose_block_strings(left, right):
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

    @staticmethod
    def _make_bespoke(blockString):
        return blockString.replace('1', '3').replace('2', '3')


class Codes:
    def __init__(self, max_digit, code_length):
        self.max_digit = max_digit
        self.code_length = code_length
        self._part_codes = self._code_iterator(self.code_length // 2, self.max_digit)
        self._full_codes = self._code_iterator(self.code_length, self.max_digit)

    @lru_cache(maxsize=None)
    def get(self, task, kind):
        if len(task) == 1:
            return next(self._part_codes)
        else:
            assert len(task) == 2
        
        a, b = task
        if kind == 'compositional':
            return self.get(a, 'left') + self.get(b, 'right')
        else:
            assert kind == 'bespoke'
            code = next(code for code in self._full_codes if 
                        not code.startswith(self.get(a, 'left')) and
                        not code.endswith(self.get(b, 'right')))
            return code
        
    def _code_iterator(self, length, max_digit):
        codes = [''.join(str(x) for x in code) for code in product(range(1, max_digit+1), repeat=length)]
        random.shuffle(codes)
        yield from codes


class Stimuli:
    def __init__(self, shapes, codes):
        self.shapes = shapes
        self.codes = codes
        self.tasks = [f"{i+1}{j+1}" for i, j in product(range(self.shapes.n_part), repeat=2)]

    def wrapper_params(self):
        return {
            'params': {
                'width': self.shapes.width,
                'height': self.shapes.height,
            },
            'shapes': {
                task: self.shapes.get(task, 'compositional') for task in self.tasks
            },
            'codes': {
                task: {
                    "compositional": self.codes.get(task, 'compositional'),
                    "bespoke": self.codes.get(task, 'bespoke'),
                }
                for task in self.tasks
            }
        }
        
    def manual_entry(self, task, kind):
        return {
            'task': task,
            'kind': kind,
            'compositional': kind == 'compositional', # TEMP
            'code': self.codes.get(task, kind),
            'blockString': self.shapes.get(task, kind)
        }
    
    def solutions(self, task):
        return {
            self.codes.get(task, 'compositional'): 'compositional',
            self.codes.get(task, 'bespoke'): 'bespoke',
        }
    
    def trial(self, task, manual):
        return {
            'task': task,
            'solutions': self.solutions(task),
            'blockString': self.shapes.get(task, 'compositional'),
            'manual': [self.manual_entry(*man) for man in manual]
        }
