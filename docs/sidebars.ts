import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/what-is-edgeai',
        'getting-started/running-a-node',
        'getting-started/using-the-sdk',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/authentication',
        'api-reference/chain',
        'api-reference/staking',
        'api-reference/governance',
        'api-reference/contracts',
        'api-reference/devices',
      ],
    },
    {
      type: 'category',
      label: 'SDK Reference',
      items: [
        'sdk/sdk-reference',
        'sdk/client',
        'sdk/types',
        'sdk/utils',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/staking-and-delegation',
        'guides/participating-in-governance',
        'guides/deploying-smart-contracts',
        'guides/registering-iot-devices',
      ],
    },
  ],
};

export default sidebars;
