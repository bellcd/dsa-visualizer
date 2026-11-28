# The factory's sandbox image for this repo. The factory builds a Daytona
# snapshot from this file; each run clones the repo into it and runs Claude Code.
FROM node:24.22.3-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl jq \
 && rm -rf /var/lib/apt/lists/*

# Exact version, at least two weeks old when pinned.
RUN npm install -g @anthropic-ai/claude-code@2.1.319

# NOTE: One full Chromium serves both Playwright and agent-browser, to save disk. Its version matches @playwright/test.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN npm install -g playwright@1.65.1 agent-browser@0.43.0 \
 && playwright install --with-deps --no-shell chromium \
 && ln -s "$(find /opt/playwright -path '*chromium-*' -name chrome -type f | head -n 1)" /usr/local/bin/chromium \
 && rm -rf /var/lib/apt/lists/*
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/local/bin/chromium

# Claude Code refuses to skip permission prompts as root.
RUN useradd --create-home --shell /bin/bash agent
USER agent
WORKDIR /home/agent

RUN git config --global user.name "bellcd-factory[bot]" \
 && git config --global user.email "360378121+bellcd-factory[bot]@users.noreply.github.com"
