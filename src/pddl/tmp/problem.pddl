;; problem file: problem-board-1.pddl
(define (problem default)
    (:domain default)
    (:objects tile_0-0 tile_0-1 tile_0-2 tile_0-3 tile_0-4 tile_0-5 tile_0-6 tile_0-7 tile_0-8 tile_0-9 tile_1-0 tile_1-1 tile_1-2 tile_1-3 tile_1-4 tile_1-5 tile_1-6 tile_1-7 tile_1-8 tile_1-9 tile_2-0 tile_2-1 tile_2-2 tile_2-3 tile_2-4 tile_2-5 tile_2-6 tile_2-7 tile_2-8 tile_2-9 tile_3-0 tile_3-1 tile_3-2 tile_3-3 tile_3-4 tile_3-5 tile_3-6 tile_3-7 tile_3-8 tile_3-9 tile_4-0 tile_4-1 tile_4-2 tile_4-3 tile_4-4 tile_4-5 tile_4-6 tile_4-7 tile_4-8 tile_4-9 tile_5-0 tile_5-1 tile_5-2 tile_5-3 tile_5-4 tile_5-5 tile_5-6 tile_5-7 tile_5-8 tile_5-9 tile_6-0 tile_6-1 tile_6-2 tile_6-3 tile_6-4 tile_6-5 tile_6-6 tile_6-7 tile_6-8 tile_6-9 tile_7-0 tile_7-1 tile_7-2 tile_7-3 tile_7-4 tile_7-5 tile_7-6 tile_7-7 tile_7-8 tile_7-9 tile_8-0 tile_8-1 tile_8-2 tile_8-3 tile_8-4 tile_8-5 tile_8-6 tile_8-7 tile_8-8 tile_8-9 tile_9-0 tile_9-1 tile_9-2 tile_9-3 tile_9-4 tile_9-5 tile_9-6 tile_9-7 tile_9-8 tile_9-9 parcel_p0 parcel_p1 parcel_p2 parcel_p3 parcel_p4 me_69c6ef6072e tile_8-4.6)
    (:init (wall tile_0-0) (right tile_0-0 tile_1-0) (up tile_0-0 tile_0-1) (wall tile_0-1) (right tile_0-1 tile_1-1) (up tile_0-1 tile_0-2) (down tile_0-1 tile_0-0) (tile tile_0-2) (right tile_0-2 tile_1-2) (up tile_0-2 tile_0-3) (down tile_0-2 tile_0-1) (wall tile_0-3) (right tile_0-3 tile_1-3) (up tile_0-3 tile_0-4) (down tile_0-3 tile_0-2) (tile tile_0-4) (right tile_0-4 tile_1-4) (up tile_0-4 tile_0-5) (down tile_0-4 tile_0-3) (wall tile_0-5) (right tile_0-5 tile_1-5) (up tile_0-5 tile_0-6) (down tile_0-5 tile_0-4) (tile tile_0-6) (right tile_0-6 tile_1-6) (up tile_0-6 tile_0-7) (down tile_0-6 tile_0-5) (wall tile_0-7) (right tile_0-7 tile_1-7) (up tile_0-7 tile_0-8) (down tile_0-7 tile_0-6) (wall tile_0-8) (right tile_0-8 tile_1-8) (up tile_0-8 tile_0-9) (down tile_0-8 tile_0-7) (wall tile_0-9) (right tile_0-9 tile_1-9) (down tile_0-9 tile_0-8) (delivery tile_1-0) (right tile_1-0 tile_2-0) (left tile_1-0 tile_0-0) (up tile_1-0 tile_1-1) (tile tile_1-1) (right tile_1-1 tile_2-1) (left tile_1-1 tile_0-1) (up tile_1-1 tile_1-2) (down tile_1-1 tile_1-0) (tile tile_1-2) (right tile_1-2 tile_2-2) (left tile_1-2 tile_0-2) (up tile_1-2 tile_1-3) (down tile_1-2 tile_1-1) (tile tile_1-3) (right tile_1-3 tile_2-3) (left tile_1-3 tile_0-3) (up tile_1-3 tile_1-4) (down tile_1-3 tile_1-2) (tile tile_1-4) (right tile_1-4 tile_2-4) (left tile_1-4 tile_0-4) (up tile_1-4 tile_1-5) (down tile_1-4 tile_1-3) (tile tile_1-5) (right tile_1-5 tile_2-5) (left tile_1-5 tile_0-5) (up tile_1-5 tile_1-6) (down tile_1-5 tile_1-4) (tile tile_1-6) (right tile_1-6 tile_2-6) (left tile_1-6 tile_0-6) (up tile_1-6 tile_1-7) (down tile_1-6 tile_1-5) (tile tile_1-7) (right tile_1-7 tile_2-7) (left tile_1-7 tile_0-7) (up tile_1-7 tile_1-8) (down tile_1-7 tile_1-6) (tile tile_1-8) (right tile_1-8 tile_2-8) (left tile_1-8 tile_0-8) (up tile_1-8 tile_1-9) (down tile_1-8 tile_1-7) (delivery tile_1-9) (right tile_1-9 tile_2-9) (left tile_1-9 tile_0-9) (down tile_1-9 tile_1-8) (wall tile_2-0) (right tile_2-0 tile_3-0) (left tile_2-0 tile_1-0) (up tile_2-0 tile_2-1) (wall tile_2-1) (right tile_2-1 tile_3-1) (left tile_2-1 tile_1-1) (up tile_2-1 tile_2-2) (down tile_2-1 tile_2-0) (tile tile_2-2) (right tile_2-2 tile_3-2) (left tile_2-2 tile_1-2) (up tile_2-2 tile_2-3) (down tile_2-2 tile_2-1) (wall tile_2-3) (right tile_2-3 tile_3-3) (left tile_2-3 tile_1-3) (up tile_2-3 tile_2-4) (down tile_2-3 tile_2-2) (tile tile_2-4) (right tile_2-4 tile_3-4) (left tile_2-4 tile_1-4) (up tile_2-4 tile_2-5) (down tile_2-4 tile_2-3) (wall tile_2-5) (right tile_2-5 tile_3-5) (left tile_2-5 tile_1-5) (up tile_2-5 tile_2-6) (down tile_2-5 tile_2-4) (tile tile_2-6) (right tile_2-6 tile_3-6) (left tile_2-6 tile_1-6) (up tile_2-6 tile_2-7) (down tile_2-6 tile_2-5) (wall tile_2-7) (right tile_2-7 tile_3-7) (left tile_2-7 tile_1-7) (up tile_2-7 tile_2-8) (down tile_2-7 tile_2-6) (tile tile_2-8) (right tile_2-8 tile_3-8) (left tile_2-8 tile_1-8) (up tile_2-8 tile_2-9) (down tile_2-8 tile_2-7) (wall tile_2-9) (right tile_2-9 tile_3-9) (left tile_2-9 tile_1-9) (down tile_2-9 tile_2-8) (wall tile_3-0) (right tile_3-0 tile_4-0) (left tile_3-0 tile_2-0) (up tile_3-0 tile_3-1) (wall tile_3-1) (right tile_3-1 tile_4-1) (left tile_3-1 tile_2-1) (up tile_3-1 tile_3-2) (down tile_3-1 tile_3-0) (tile tile_3-2) (right tile_3-2 tile_4-2) (left tile_3-2 tile_2-2) (up tile_3-2 tile_3-3) (down tile_3-2 tile_3-1) (wall tile_3-3) (right tile_3-3 tile_4-3) (left tile_3-3 tile_2-3) (up tile_3-3 tile_3-4) (down tile_3-3 tile_3-2) (tile tile_3-4) (right tile_3-4 tile_4-4) (left tile_3-4 tile_2-4) (up tile_3-4 tile_3-5) (down tile_3-4 tile_3-3) (wall tile_3-5) (right tile_3-5 tile_4-5) (left tile_3-5 tile_2-5) (up tile_3-5 tile_3-6) (down tile_3-5 tile_3-4) (tile tile_3-6) (right tile_3-6 tile_4-6) (left tile_3-6 tile_2-6) (up tile_3-6 tile_3-7) (down tile_3-6 tile_3-5) (wall tile_3-7) (right tile_3-7 tile_4-7) (left tile_3-7 tile_2-7) (up tile_3-7 tile_3-8) (down tile_3-7 tile_3-6) (tile tile_3-8) (right tile_3-8 tile_4-8) (left tile_3-8 tile_2-8) (up tile_3-8 tile_3-9) (down tile_3-8 tile_3-7) (tile tile_3-9) (right tile_3-9 tile_4-9) (left tile_3-9 tile_2-9) (down tile_3-9 tile_3-8) (wall tile_4-0) (right tile_4-0 tile_5-0) (left tile_4-0 tile_3-0) (up tile_4-0 tile_4-1) (wall tile_4-1) (right tile_4-1 tile_5-1) (left tile_4-1 tile_3-1) (up tile_4-1 tile_4-2) (down tile_4-1 tile_4-0) (tile tile_4-2) (right tile_4-2 tile_5-2) (left tile_4-2 tile_3-2) (up tile_4-2 tile_4-3) (down tile_4-2 tile_4-1) (wall tile_4-3) (right tile_4-3 tile_5-3) (left tile_4-3 tile_3-3) (up tile_4-3 tile_4-4) (down tile_4-3 tile_4-2) (tile tile_4-4) (right tile_4-4 tile_5-4) (left tile_4-4 tile_3-4) (up tile_4-4 tile_4-5) (down tile_4-4 tile_4-3) (wall tile_4-5) (right tile_4-5 tile_5-5) (left tile_4-5 tile_3-5) (up tile_4-5 tile_4-6) (down tile_4-5 tile_4-4) (tile tile_4-6) (right tile_4-6 tile_5-6) (left tile_4-6 tile_3-6) (up tile_4-6 tile_4-7) (down tile_4-6 tile_4-5) (wall tile_4-7) (right tile_4-7 tile_5-7) (left tile_4-7 tile_3-7) (up tile_4-7 tile_4-8) (down tile_4-7 tile_4-6) (wall tile_4-8) (right tile_4-8 tile_5-8) (left tile_4-8 tile_3-8) (up tile_4-8 tile_4-9) (down tile_4-8 tile_4-7) (delivery tile_4-9) (right tile_4-9 tile_5-9) (left tile_4-9 tile_3-9) (down tile_4-9 tile_4-8) (delivery tile_5-0) (right tile_5-0 tile_6-0) (left tile_5-0 tile_4-0) (up tile_5-0 tile_5-1) (tile tile_5-1) (right tile_5-1 tile_6-1) (left tile_5-1 tile_4-1) (up tile_5-1 tile_5-2) (down tile_5-1 tile_5-0) (tile tile_5-2) (right tile_5-2 tile_6-2) (left tile_5-2 tile_4-2) (up tile_5-2 tile_5-3) (down tile_5-2 tile_5-1) (tile tile_5-3) (right tile_5-3 tile_6-3) (left tile_5-3 tile_4-3) (up tile_5-3 tile_5-4) (down tile_5-3 tile_5-2) (tile tile_5-4) (right tile_5-4 tile_6-4) (left tile_5-4 tile_4-4) (up tile_5-4 tile_5-5) (down tile_5-4 tile_5-3) (tile tile_5-5) (right tile_5-5 tile_6-5) (left tile_5-5 tile_4-5) (up tile_5-5 tile_5-6) (down tile_5-5 tile_5-4) (tile tile_5-6) (right tile_5-6 tile_6-6) (left tile_5-6 tile_4-6) (up tile_5-6 tile_5-7) (down tile_5-6 tile_5-5) (tile tile_5-7) (right tile_5-7 tile_6-7) (left tile_5-7 tile_4-7) (up tile_5-7 tile_5-8) (down tile_5-7 tile_5-6) (tile tile_5-8) (right tile_5-8 tile_6-8) (left tile_5-8 tile_4-8) (up tile_5-8 tile_5-9) (down tile_5-8 tile_5-7) (tile tile_5-9) (right tile_5-9 tile_6-9) (left tile_5-9 tile_4-9) (down tile_5-9 tile_5-8) (tile tile_6-0) (right tile_6-0 tile_7-0) (left tile_6-0 tile_5-0) (up tile_6-0 tile_6-1) (tile tile_6-1) (right tile_6-1 tile_7-1) (left tile_6-1 tile_5-1) (up tile_6-1 tile_6-2) (down tile_6-1 tile_6-0) (tile tile_6-2) (right tile_6-2 tile_7-2) (left tile_6-2 tile_5-2) (up tile_6-2 tile_6-3) (down tile_6-2 tile_6-1) (tile tile_6-3) (right tile_6-3 tile_7-3) (left tile_6-3 tile_5-3) (up tile_6-3 tile_6-4) (down tile_6-3 tile_6-2) (tile tile_6-4) (right tile_6-4 tile_7-4) (left tile_6-4 tile_5-4) (up tile_6-4 tile_6-5) (down tile_6-4 tile_6-3) (tile tile_6-5) (right tile_6-5 tile_7-5) (left tile_6-5 tile_5-5) (up tile_6-5 tile_6-6) (down tile_6-5 tile_6-4) (tile tile_6-6) (right tile_6-6 tile_7-6) (left tile_6-6 tile_5-6) (up tile_6-6 tile_6-7) (down tile_6-6 tile_6-5) (tile tile_6-7) (right tile_6-7 tile_7-7) (left tile_6-7 tile_5-7) (up tile_6-7 tile_6-8) (down tile_6-7 tile_6-6) (tile tile_6-8) (right tile_6-8 tile_7-8) (left tile_6-8 tile_5-8) (up tile_6-8 tile_6-9) (down tile_6-8 tile_6-7) (tile tile_6-9) (right tile_6-9 tile_7-9) (left tile_6-9 tile_5-9) (down tile_6-9 tile_6-8) (wall tile_7-0) (right tile_7-0 tile_8-0) (left tile_7-0 tile_6-0) (up tile_7-0 tile_7-1) (wall tile_7-1) (right tile_7-1 tile_8-1) (left tile_7-1 tile_6-1) (up tile_7-1 tile_7-2) (down tile_7-1 tile_7-0) (tile tile_7-2) (right tile_7-2 tile_8-2) (left tile_7-2 tile_6-2) (up tile_7-2 tile_7-3) (down tile_7-2 tile_7-1) (wall tile_7-3) (right tile_7-3 tile_8-3) (left tile_7-3 tile_6-3) (up tile_7-3 tile_7-4) (down tile_7-3 tile_7-2) (wall tile_7-4) (right tile_7-4 tile_8-4) (left tile_7-4 tile_6-4) (up tile_7-4 tile_7-5) (down tile_7-4 tile_7-3) (wall tile_7-5) (right tile_7-5 tile_8-5) (left tile_7-5 tile_6-5) (up tile_7-5 tile_7-6) (down tile_7-5 tile_7-4) (tile tile_7-6) (right tile_7-6 tile_8-6) (left tile_7-6 tile_6-6) (up tile_7-6 tile_7-7) (down tile_7-6 tile_7-5) (wall tile_7-7) (right tile_7-7 tile_8-7) (left tile_7-7 tile_6-7) (up tile_7-7 tile_7-8) (down tile_7-7 tile_7-6) (wall tile_7-8) (right tile_7-8 tile_8-8) (left tile_7-8 tile_6-8) (up tile_7-8 tile_7-9) (down tile_7-8 tile_7-7) (tile tile_7-9) (right tile_7-9 tile_8-9) (left tile_7-9 tile_6-9) (down tile_7-9 tile_7-8) (wall tile_8-0) (right tile_8-0 tile_9-0) (left tile_8-0 tile_7-0) (up tile_8-0 tile_8-1) (wall tile_8-1) (right tile_8-1 tile_9-1) (left tile_8-1 tile_7-1) (up tile_8-1 tile_8-2) (down tile_8-1 tile_8-0) (tile tile_8-2) (right tile_8-2 tile_9-2) (left tile_8-2 tile_7-2) (up tile_8-2 tile_8-3) (down tile_8-2 tile_8-1) (wall tile_8-3) (right tile_8-3 tile_9-3) (left tile_8-3 tile_7-3) (up tile_8-3 tile_8-4) (down tile_8-3 tile_8-2) (tile tile_8-4) (right tile_8-4 tile_9-4) (left tile_8-4 tile_7-4) (up tile_8-4 tile_8-5) (down tile_8-4 tile_8-3) (tile tile_8-5) (right tile_8-5 tile_9-5) (left tile_8-5 tile_7-5) (up tile_8-5 tile_8-6) (down tile_8-5 tile_8-4) (tile tile_8-6) (right tile_8-6 tile_9-6) (left tile_8-6 tile_7-6) (up tile_8-6 tile_8-7) (down tile_8-6 tile_8-5) (wall tile_8-7) (right tile_8-7 tile_9-7) (left tile_8-7 tile_7-7) (up tile_8-7 tile_8-8) (down tile_8-7 tile_8-6) (wall tile_8-8) (right tile_8-8 tile_9-8) (left tile_8-8 tile_7-8) (up tile_8-8 tile_8-9) (down tile_8-8 tile_8-7) (tile tile_8-9) (right tile_8-9 tile_9-9) (left tile_8-9 tile_7-9) (down tile_8-9 tile_8-8) (wall tile_9-0) (left tile_9-0 tile_8-0) (up tile_9-0 tile_9-1) (wall tile_9-1) (left tile_9-1 tile_8-1) (up tile_9-1 tile_9-2) (down tile_9-1 tile_9-0) (tile tile_9-2) (left tile_9-2 tile_8-2) (up tile_9-2 tile_9-3) (down tile_9-2 tile_9-1) (delivery tile_9-3) (left tile_9-3 tile_8-3) (up tile_9-3 tile_9-4) (down tile_9-3 tile_9-2) (tile tile_9-4) (left tile_9-4 tile_8-4) (up tile_9-4 tile_9-5) (down tile_9-4 tile_9-3) (wall tile_9-5) (left tile_9-5 tile_8-5) (up tile_9-5 tile_9-6) (down tile_9-5 tile_9-4) (tile tile_9-6) (left tile_9-6 tile_8-6) (up tile_9-6 tile_9-7) (down tile_9-6 tile_9-5) (wall tile_9-7) (left tile_9-7 tile_8-7) (up tile_9-7 tile_9-8) (down tile_9-7 tile_9-6) (wall tile_9-8) (left tile_9-8 tile_8-8) (up tile_9-8 tile_9-9) (down tile_9-8 tile_9-7) (delivery tile_9-9) (left tile_9-9 tile_8-9) (down tile_9-9 tile_9-8) (parcel parcel_p0) (parcel parcel_p1) (parcel parcel_p2) (parcel parcel_p3) (parcel parcel_p4) (me me_69c6ef6072e) (at parcel_p0 tile_2-6) (at parcel_p1 tile_7-6) (at parcel_p2 tile_8-6) (at parcel_p3 tile_5-9) (at parcel_p4 tile_6-4) (at me_69c6ef6072e tile_8-4.6))
    (:goal (carriedBy parcel_p2 me_69c6ef6072e))
)
