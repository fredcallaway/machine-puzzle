using StatsBase
using JSON
using Random

n_potion = 6
n_spell = 9
n_task = 10

potions = 0:n_potion-1
spells = 0:n_spell-1

Random.seed!(hash("v1.1"))

transitions = map(potions) do potion
    others = setdiff(potions, potion)
    Dict(sample(spells, length(others); replace=false) .=> others)
end

flat_transitions = mapreduce(vcat, potions, transitions) do chem1, trns
    map(collect(trns)) do (spell, chem2)
        [chem1, spell, chem2]
    end
end

all_tasks = filter(collect(Iterators.product(potions, potions))[:]) do (a, b)
    a != b
end

function rejection_sample(generate, condition; max_try=10000)
    for i in 1:max_try
        x = generate()
        condition(x) && return x
    end
    error("Hit max_try")
end

function valid_example(recipes)
    chem1, spell, chem2 = recipes[1]
    !(chem2 == middle && haskey(transitions[chem2+1], spell))
end

function edges_to_recipes(edges)
    map(edges) do (a, b)
        s, c2 = filter(transitions[a]) do (s, c2)
            c2 == b - 1
        end |> only
        [a - 1, s, c2]
    end
end

function sample_recipes(type)
    if type == "random"
        sample(flat_transitions, 2*(n_potion-1), replace=false)
    elseif type == "ring"
        ring = randperm(n_potion)
        edges = map(1:n_potion) do i
            (ring[i], ring[mod1(i+1, n_potion)])
        end
        shuffle(edges_to_recipes(edges))
    elseif type == "hub"
        hub, others... = shuffle(1:n_potion)
        edges = mapreduce(vcat, others) do o
            [(hub, o), (o, hub)]
        end
        shuffle(edges_to_recipes(edges))
    end
end


info_types = ["random", "ring", "hub"]

foreach(1:30) do i
    information_type = info_types[mod1(i, length(info_types))]
    recipes = rejection_sample(valid_example) do
        sample_recipes(information_type)
    end
    write("static/json/$i.json", json((;
        transitions,
        tasks = sample(all_tasks, n_task, replace=false),
        recipes,
        nPotion = n_potion,
        nSpell = n_spell,
        information_type
    )))
end

