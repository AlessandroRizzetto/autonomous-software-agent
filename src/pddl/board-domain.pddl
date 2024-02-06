;; domain file: board-domain.pddl
(define (domain default)
    (:requirements :strips)
    (:predicates
        (tile ?t)
        (delivery ?t)
        (wall ?t)
        (agent ?a)
        (parcel ?p)
        (me ?a)
        (right ?t1 ?t2)
        (left ?t1 ?t2)
        (up ?t1 ?t2)
        (down ?t1 ?t2)
        (at ?agentOrParcel ?tile)
        (carriedBy ?parcel ?agent)
    )

    (:action right
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (not (wall ?from))
            (not (wall ?to))
            (tile ?from)
            (tile ?to)
            (at ?me ?from)
            (right ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )

    (:action left
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (not (wall ?from))
            (not (wall ?to))
            (tile ?from)
            (tile ?to)
            (at ?me ?from)
            (left ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )

    (:action up
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (not (wall ?from))
            (not (wall ?to))
            (tile ?from)
            (tile ?to)
            (at ?me ?from)
            (up ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )

    (:action down
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (not (wall ?from))
            (not (wall ?to))
            (tile ?from)
            (tile ?to)
            (at ?me ?from)
            (down ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )

    (:action pickup
        :parameters (?me ?parcel ?tile)
        :precondition (and
            (me ?me)
            (parcel ?parcel)
            (tile ?tile)
            (at ?me ?tile)
            (at ?parcel ?tile)
            (not (carriedBy ?parcel ?me))
        )
        :effect (and
            (not (at ?parcel ?tile))
            (carriedBy ?parcel ?me)
        )
    )

    (:action putdown
        :parameters (?me ?parcel ?tile)
        :precondition (and
            (me ?me)
            (parcel ?parcel)
            (tile ?tile)
            (at ?me ?tile)
            (carriedBy ?parcel ?me)
        )
        :effect (and
            (at ?parcel ?tile)
            (not (carriedBy ?parcel ?me))
        )
    )
)