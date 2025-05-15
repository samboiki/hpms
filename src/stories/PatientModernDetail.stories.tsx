import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import PatientModernDetail from '../pages/PatientModernDetail';

const meta = {
  title: 'Pages/PatientModernDetail',
  component: PatientModernDetail,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof PatientModernDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};