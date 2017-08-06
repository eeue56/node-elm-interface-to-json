module Main exposing (hello)

import Json.Decode
import Other exposing (..)


hello : Int -> Int
hello x =
    x + 1


fish : String -> Int
fish str =
    5


blob : String -> String -> String
blob x y =
    x


decodeName : Json.Decode.Decoder String
decodeName =
    Json.Decode.string


otherThing : Other String Int
otherThing =
    Other "" 1
