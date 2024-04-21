using StatsBase
using JSON

n_potion = 5
n_spell = 8
n_task = 5

potions = 0:n_potion-1
spells = 0:n_spell-1

transitions = map(potions) do potion
    others = setdiff(potions, potion)
    Dict(sample(spells, length(others); replace=false) .=> others)
end

tasks = collect(Iterators.product(1:n_potion, 1:n_potion))[:]
sample(tasks, n_task, replace=false)

mkpath("static/json")
foreach(1:100) do i
    JSON.write("static/json/$i", (;
        transitions
    ))

