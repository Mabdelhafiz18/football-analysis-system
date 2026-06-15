# Foul Detection Module

This module consumes frame packets from Redis stream
- input `vcmatch_final_001`

It builds a temporal window and generates foul candidates using
- player proximity
- sudden speed or direction changes
- ball possession context
- possession switch

Then it writes scored foul events to
- output `evtfoulmatch_final_001`