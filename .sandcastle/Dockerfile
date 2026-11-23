# The factory's sandbox image for this repo. The factory builds a Daytona
# snapshot from this file; each run clones the repo into it and runs Claude Code.
FROM node:22.22.1-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates jq \
 && rm -rf /var/lib/apt/lists/*

# Exact version, at least two weeks old when pinned.
RUN npm install -g @anthropic-ai/claude-code@2.1.319

# Claude Code refuses to skip permission prompts as root.
RUN useradd --create-home --shell /bin/bash agent
USER agent
WORKDIR /home/agent

RUN git config --global user.name "factory[bot]" \
 && git config --global user.email "factory@users.noreply.github.com"
