# Issue tracker: Linear

Tickets for this repo live in the **Visualizer** team in Linear.

## Conventions

- **Reach Linear** through its MCP server when the session has one, or its GraphQL API (`https://api.linear.app/graphql`, with a personal API key in `LINEAR_API_KEY` as the `Authorization` header). Neither available: write the ticket out in full for the user to paste.
- **Create a ticket** (a skill's "publish to the issue tracker"): in the Visualizer team, status **Backlog**. The title names the outcome, e.g. "Binary search". The description is the spec, in the shape `docs/trace-format.md` gives under "What a ticket spec looks like".
- **Size**: Linear's T-shirt estimate, S, M or L. Leave it unset for the user to decide when unsure.
- **Blocking**: Linear's "blocked by" relation.


## Triage labels

The `triage` skill's roles map to these Linear labels.

| Triage role | Linear label |
| --- | --- |
| `bug` | Bug |
| `enhancement` | Feature for new behavior, Improvement for better existing behavior |
| `needs-triage` | Needs Triage |
| `needs-info` | Needs Info |
| `ready-for-agent` | Ready for Agent |
| `ready-for-human` | Ready for Human |
| `wontfix` | Won't Fix |

The state labels sit in the **Readiness** label group, so a ticket carries at most one. Setting Needs Triage asks the factory to triage the ticket.
