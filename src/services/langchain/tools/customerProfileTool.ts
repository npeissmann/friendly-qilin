import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { CustomerProfile } from '../types.js';
import { MOCK_CUSTOMERS, PREDEFINED_SCENARIOS } from '../data/mockCustomers.js';

export { MOCK_CUSTOMERS, PREDEFINED_SCENARIOS };

function findCustomerByIdOrName(query: string): CustomerProfile | undefined {
  const normalizedId = query.trim().toUpperCase();
  if (MOCK_CUSTOMERS[normalizedId]) {
    return MOCK_CUSTOMERS[normalizedId];
  }

  const normalizedName = query.trim().toLowerCase();
  return Object.values(MOCK_CUSTOMERS).find(
    (customer) =>
      customer.customerId.toLowerCase() === normalizedName ||
      customer.name.toLowerCase().includes(normalizedName)
  );
}

/**
 * LangChain tool to look up a customer's Credit Bureau, Open Finance, ESG, and Delinquency profile.
 */
export const customerProfileLangChainTool = tool(
  async ({ customerIdOrName }) => {
    const matched = findCustomerByIdOrName(customerIdOrName);

    if (!matched) {
      const availableIds = Object.keys(MOCK_CUSTOMERS);
      return JSON.stringify({
        found: false,
        availableCustomerIds: availableIds,
        message: `No customer found matching "${customerIdOrName}". Available IDs: ${availableIds.join(', ')}`,
      });
    }

    return JSON.stringify({
      found: true,
      profile: matched,
    });
  },
  {
    name: 'lookup_customer_profile',
    description:
      'Retrieves a customer profile from the Credit Bureau, Open Finance gateway, ESG registry, and Collections system by Customer ID (e.g., CUST-001, CUST-002, CUST-003, CUST-004) or customer name.',
    schema: z.object({
      customerIdOrName: z
        .string()
        .describe('Customer ID (such as "CUST-001") or customer name (such as "Alice Silva").'),
    }),
  }
);
