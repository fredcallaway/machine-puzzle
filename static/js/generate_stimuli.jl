using StatsBase
using JSON

n_potion = 5
n_spell = 8

potions = 0:n_potion-1
spells = 0:n_spell-1

map(potions) do potion
    others = setdiff(potions, potion)
    Dict(sample(spells, length(others); replace=false) .=> others)
end |> json |> println