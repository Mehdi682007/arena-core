# ADR-0004: Versioned Data-driven Game Configuration

Status: Accepted

## Context

FC26 is only the first test game. Match rules must remain historically stable while administrators can add games without core changes.

## Decision

Store games, platforms, modes, crossplay policy, and immutable rule-set versions as data. Use registered typed strategies for scoring, comparison, rating, and tournament behavior. Do not execute administrator-authored code.

## Consequences

Most games can be added through configuration. Truly novel mechanics require a reviewed strategy implementation, while historical matches remain tied to their original rule snapshot.
