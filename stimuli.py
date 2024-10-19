def separate_shapes(grid_string):
    # Split the string into rows
    rows = grid_string.strip().split('\n')
    
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

# Use the function
grid_string = """
_________
_111_2___
_1_122___
_1111222_
_1_122___
_111_2___
_________
_111___2_
___122_2_
__111222_
___122_2_
_111___2_
_________
___1_____
_1112222_
___112___
_1112222_
___1_____
_________
_1_1_2___
_1_1222__
_1111222_
_1_1222__
_1_1_2___
_________
_111_222_
_11122___
___112___
_11122___
_111_222_
_________
_111_222_
_1_122_2_
___112_2_
_1_122_2_
_111_222_
_________
"""

separated_shapes = separate_shapes(grid_string)

# Separate shapes into lists for 1s and 2s
shapes_1 = separated_shapes[::2]  # Every even-indexed shape (0, 2, 4, ...)
shapes_2 = separated_shapes[1::2]  # Every odd-indexed shape (1, 3, 5, ...)

import json
json.dump({'left': shapes_1, 'right': shapes_2}, open('stimuli.json', 'w'))
