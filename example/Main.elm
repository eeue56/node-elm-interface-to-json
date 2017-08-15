module Main exposing (hello)

{-| @docs hello
-}

import Json.Decode
import Other exposing (..)


{-| Say hello
-}
hello : Int -> Int
hello x =
    x + 1


{-| fish fish fish
-}
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


type God
    = Dog
    | God


type alias Cat =
    Json.Decode.Decoder String


type alias Model =
    { name : String }
