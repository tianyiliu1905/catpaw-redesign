# Conversation Motion Lab

Open `index.html` directly in a browser. No server is required. You can copy this entire folder to another location.

- `index.html`, `lab.css`, `lab.js`: four transition variants for progress text, tool calls, and results.
- `agent-motion.html`: a standalone copy of the subagent A / B animation, including fading tails, colored avatars, a waiting state, and a text shimmer.
- `assets/`: local icons used by these pages.

## Compare the variants

1. Select **Next** to trigger all variants together, or **Autoplay** to watch the full workflow.
2. Choose **Final step → Result** to focus on the transition from work to results.
3. Set the speed to **0.5×** or **0.25×** to inspect details. You can pause and resume during a transition.
4. Click a tool row to expand its details. Select **Replay** to return to the beginning of the selected scene.

The pages show only case names and live examples, with a compact playback toolbar.

A preserves the current demo’s leftward direction and text-first, tool-second exit sequence. B rolls tool calls upward within a clipped row, C uses a subtle scale, and D uses a blur reveal. When transitioning to results, the previous work area exits as a whole.

Typography follows the project’s 15px / 26px body text and 14px / 22px tool text. With reduced motion enabled, text and tools switch immediately. Subagent motion starts paused and can be played manually.

This is an independent experiment. Changes here do not update the main demo. After choosing a variant, port it back to the main demo.
