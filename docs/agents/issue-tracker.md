# Issue tracker: Linear

Tickets for this repo live in the **Visualizer** team in Linear (issue keys `VS-<n>`). GitHub Issues are off.

## Conventions

- **Reach Linear** through its MCP server when the session has one, or its GraphQL API (`https://api.linear.app/graphql`, with a personal API key in `LINEAR_API_KEY` as the `Authorization` header). Neither available: write the ticket out in full for the user to paste.
- **Create a ticket**: in the Visualizer team, status **Backlog**. The title names the outcome, e.g. "Binary search". The description is the spec, in the shape `docs/trace-format.md` gives under "What a ticket spec looks like".
- **Size**: Linear's T-shirt estimate, S, M or L. Leave it unset for the user to decide when unsure.
- **Blocking**: Linear's "blocked by" relation. A ticket is startable when every blocker is Done.
- **Read a ticket**: its title, description and comments, oldest comment first.
- **Comment**: a plain comment on the ticket.
- **Ready for agent** is the status that hands a ticket to an agent run. Moving a ticket there is the user's call.

## When a skill says "publish to the issue tracker"

Create a Linear ticket as above.

## When a skill says "fetch the relevant ticket"

Read it as in **Read a ticket** above.
