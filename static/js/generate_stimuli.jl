using StatsBase
using JSON
using Random

n_potion = 5
n_spell = 8
n_task = 5

potions = 0:n_potion-1
spells = 0:n_spell-1

Random.seed!(1)

transitions = map(potions) do potion
    others = setdiff(potions, potion)
    Dict(sample(spells, length(others); replace=false) .=> others)
end

flat_transitions = mapreduce(vcat, potions, transitions) do chem1, trns
    map(collect(trns)) do (spell, chem2)
        [chem1, spell, chem2]
    end
end


all_tasks = collect(Iterators.product(1:n_potion, 1:n_potion))[:]
mkpath("static/json")
foreach(1:10) do i
    write("static/json/$i.json", json((;
        transitions,
        tasks = sample(all_tasks, n_task, replace=false),
        recipes = sample(flat_transitions, 5, replace=false)
    )))
end
