import { actionForms, actionAliases } from '@/constants/actionForms';

const exportEndpointMap = {
  sales: '/exports/sales',
  purchases: '/exports/purchases',
  customers: '/exports/customers',
  suppliers: '/exports/suppliers',
  products: '/exports/products',
};

export const resolveActionConfig = (label, context = {}) => {
  const key = actionForms[label] ? label : actionAliases[label];
  const baseConfig = key ? actionForms[key] : actionForms[label];

  if (!baseConfig) {
    return {
      label,
      infoOnly: true,
      description: 'This action is not configured yet.',
    };
  }

  const config = { ...baseConfig };

  const baseEndpoint = config.endpoint || (context.resource ? `/${context.resource}` : null);
  const download = config.download
    ? {
        ...config.download,
        endpoint:
          config.download.endpoint ||
          exportEndpointMap[context.resource] ||
          `/exports/${context.resource || 'products'}`,
      }
    : null;

  let endpoint = baseEndpoint;
  let method = config.method || 'post';

  if (context.mode === 'edit' && context.record?.id && baseEndpoint) {
    endpoint = `${baseEndpoint}/${context.record.id}`;
    method = config.editMethod || 'put';
  }

  return {
    label,
    ...config,
    endpoint,
    method,
    download,
    resourceParams: context.resourceParams,
    record: context.record,
  };
};
