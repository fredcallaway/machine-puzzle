using StatsBase
using JSON
using Random

n_chemical = 6
n_mode = 8
n_task = 10

Random.seed!(hash("v1.1"))


transitions = rand(1:n_mode, (n_chemical, n_chemical))

all_tasks = filter(collect(Iterators.product(1:n_chemical, 1:n_chemical))[:]) do (a, b)
    a != b
end

flat_transitions = map(CartesianIndices(transitions)) do i
    a, b = Tuple(i)
    [a, transitions[i], b]
end

function rejection_sample(generate, condition; max_try=10000)
    for i in 1:max_try
        x = generate()
        condition(x) && return x
    end
    error("Hit max_try")
end

function valid_example(recipes)
    chem1, mode, chem2 = recipes[1]
    !any(isequal(mode), transitions[chem2, :])
end

function edges_to_recipes(edges)
    map(edges) do (a, b)
        [a, transitions[a, b], b]
    end
end

function sample_recipes(type)
    if type == "random"
        sample(flat_transitions, 2*(n_chemical-1), replace=false)
    elseif type == "ring"
        ring = randperm(n_chemical)
        edges = map(1:n_chemical) do i
            (ring[i], ring[mod1(i+1, n_chemical)])
        end
        shuffle(edges_to_recipes(edges))
    elseif type == "hub"
        hub, others... = shuffle(1:n_chemical)
        edges = mapreduce(vcat, others) do o
            [(hub, o), (o, hub)]
        end
        shuffle(edges_to_recipes(edges))
    end
end



zero_index(x::Int) = x - 1
zero_index(x::AbstractArray) = map(zero_index, x)
zero_index(x::Tuple) = map(zero_index, x)


info_types = ["random", "ring", "hub"]

foreach(1:30) do i
    information_type = info_types[mod1(i, length(info_types))]
    recipes = rejection_sample(valid_example) do
        sample_recipes(information_type)
    end
    @assert all(recipes) do r
        r in flat_transitions &&
        transitions[r[1], r[3]] == r[2]
    end
    @infiltrate i == 3
    zero_index(recipes)[1]
    zero_index(transitions)[3, 5]

    write("static/json/$i.json", json((;
        transitions = zero_index(transpose(transitions)),
        tasks = zero_index(sample(all_tasks, n_task, replace=false)),
        recipes = zero_index(recipes),
        nChemical = n_chemical,
        nMode = n_mode,
        information_type
    )))
end

