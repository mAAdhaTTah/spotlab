import "../src/hand-matrix.css";
import type { Preview } from "@storybook/react-vite";
import { initRange } from "@spotlab/range";

const preview: Preview = {
  beforeAll: async () => {
    await initRange();
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
