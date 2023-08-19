;; problem file: problem-board-0.pddl
(define (problem default)
    (:domain default)
    (:objects tile_0-0 tile_0-1 tile_0-2 tile_0-3 tile_0-4 tile_0-5 tile_0-6 tile_0-7 tile_0-8 tile_0-9 tile_1-0 tile_1-1 tile_1-2 tile_1-3 tile_1-4 tile_1-5 tile_1-6 tile_1-7 tile_1-8 tile_1-9 tile_2-0 tile_2-1 tile_2-2 tile_2-3 tile_2-4 tile_2-5 tile_2-6 tile_2-7 tile_2-8 tile_2-9 tile_3-0 tile_3-1 tile_3-2 tile_3-3 tile_3-4 tile_3-5 tile_3-6 tile_3-7 tile_3-8 tile_3-9 tile_4-0 tile_4-1 tile_4-2 tile_4-3 tile_4-4 tile_4-5 tile_4-6 tile_4-7 tile_4-8 tile_4-9 tile_5-0 tile_5-1 tile_5-2 tile_5-3 tile_5-4 tile_5-5 tile_5-6 tile_5-7 tile_5-8 tile_5-9 tile_6-0 tile_6-1 tile_6-2 tile_6-3 tile_6-4 tile_6-5 tile_6-6 tile_6-7 tile_6-8 tile_6-9 tile_7-0 tile_7-1 tile_7-2 tile_7-3 tile_7-4 tile_7-5 tile_7-6 tile_7-7 tile_7-8 tile_7-9 tile_8-0 tile_8-1 tile_8-2 tile_8-3 tile_8-4 tile_8-5 tile_8-6 tile_8-7 tile_8-8 tile_8-9 tile_9-0 tile_9-1 tile_9-2 tile_9-3 tile_9-4 tile_9-5 tile_9-6 tile_9-7 tile_9-8 tile_9-9 parcel_p0 parcel_p1 parcel_p2 parcel_p4 parcel_p5 me_6e5d29d4d1a)
    (:init (wall tile_0-0) (wall tile_0-1) (tile tile_0-2) (wall tile_0-3) (tile tile_0-4) (wall tile_0-5) (tile tile_0-6) (wall tile_0-7) (wall tile_0-8) (wall tile_0-9) (tile tile_1-0) (delivery tile_1-0) (tile tile_1-1) (tile tile_1-2) (tile tile_1-3) (tile tile_1-4) (tile tile_1-5) (tile tile_1-6) (tile tile_1-7) (tile tile_1-8) (tile tile_1-9) (delivery tile_1-9) (wall tile_2-0) (wall tile_2-1) (tile tile_2-2) (wall tile_2-3) (tile tile_2-4) (wall tile_2-5) (tile tile_2-6) (wall tile_2-7) (tile tile_2-8) (wall tile_2-9) (wall tile_3-0) (wall tile_3-1) (tile tile_3-2) (wall tile_3-3) (tile tile_3-4) (wall tile_3-5) (tile tile_3-6) (wall tile_3-7) (tile tile_3-8) (tile tile_3-9) (wall tile_4-0) (wall tile_4-1) (tile tile_4-2) (wall tile_4-3) (tile tile_4-4) (wall tile_4-5) (tile tile_4-6) (wall tile_4-7) (wall tile_4-8) (tile tile_4-9) (delivery tile_4-9) (tile tile_5-0) (delivery tile_5-0) (tile tile_5-1) (tile tile_5-2) (tile tile_5-3) (tile tile_5-4) (tile tile_5-5) (tile tile_5-6) (tile tile_5-7) (tile tile_5-8) (tile tile_5-9) (tile tile_6-0) (tile tile_6-1) (tile tile_6-2) (tile tile_6-3) (tile tile_6-4) (tile tile_6-5) (tile tile_6-6) (tile tile_6-7) (tile tile_6-8) (tile tile_6-9) (wall tile_7-0) (wall tile_7-1) (tile tile_7-2) (wall tile_7-3) (wall tile_7-4) (wall tile_7-5) (tile tile_7-6) (wall tile_7-7) (wall tile_7-8) (tile tile_7-9) (wall tile_8-0) (wall tile_8-1) (tile tile_8-2) (wall tile_8-3) (tile tile_8-4) (tile tile_8-5) (tile tile_8-6) (wall tile_8-7) (wall tile_8-8) (tile tile_8-9) (wall tile_9-0) (wall tile_9-1) (tile tile_9-2) (tile tile_9-3) (delivery tile_9-3) (tile tile_9-4) (wall tile_9-5) (tile tile_9-6) (wall tile_9-7) (wall tile_9-8) (tile tile_9-9) (delivery tile_9-9) (parcel parcel_p0) (parcel parcel_p1) (parcel parcel_p2) (parcel parcel_p4) (parcel parcel_p5) (me me_6e5d29d4d1a) (at parcel_p0 tile_6-5) (at parcel_p1 tile_6-2) (at parcel_p2 tile_3-6) (at parcel_p4 tile_2-6) (at parcel_p5 tile_8-5) (at me_6e5d29d4d1a tile_4-9))
    (:goal (carriedBy parcel_p0 me_6e5d29d4d1a))
)
