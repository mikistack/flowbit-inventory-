export const actionAliases = {
  'Create Product': 'Add Product',
  'Create Quotation': 'New Quotation',
  'Create Template': 'Label Template',
  'Print Labels': 'Print Labels',
  'Generate Labels': 'Print Labels',
  'Import CSV': 'Import CSV',
  'Export PDF': 'Export Sales Report',
  'Export CSV': 'Export CSV',
  'Export Excel': 'Export CSV',
  'Add Product Category': 'Add Product Category',
};

export const actionForms = {
  'Add Product': {
    endpoint: '/products',
    method: 'post',
    successMessage: 'Product created successfully.',
    fields: [
      {
        name: 'name',
        label: 'Product Name',
        type: 'text',
        required: true,
        placeholder: 'Wireless Barcode Scanner',
      },
      {
        name: 'price',
        label: 'Selling Price',
        type: 'number',
        required: true,
        min: 0,
        step: '0.01',
        inputmode: 'decimal',
      },
      {
        name: 'categoryId',
        label: 'Category',
        type: 'select',
        optionsSource: 'categories',
        labelKey: 'name',
        valueKey: 'id',
        helper: 'Required for reporting and filters.',
      },
      {
        name: 'brandId',
        label: 'Brand',
        type: 'select',
        optionsSource: 'brands',
        labelKey: 'name',
        valueKey: 'id',
      },
      {
        name: 'productImage',
        label: 'Product Image',
        type: 'image',
        capture: true,
        helper: 'Desktop: choose an image file. Mobile: take a photo or pick from gallery.',
      },
      {
        name: 'code',
        label: 'Barcode / SKU',
        type: 'barcode',
        placeholder: 'Scan with camera or gun if code exists',
        autofocus: true,
        helper:
          'Use your camera or a barcode scanner to fill this field. Leave empty to let Flow Bit assign one automatically.',
      },
      {
        name: 'barcodeMode',
        label: 'Barcode Option',
        type: 'select',
        default: 'scan',
        options: [
          { label: 'Scan existing barcode', value: 'scan' },
          { label: 'Assign automatically', value: 'auto' },
        ],
        helper: 'Select auto when the product does not ship with a barcode and needs a Flow Bit one for printing.',
      },
      {
        name: 'unitId',
        label: 'Unit',
        type: 'select',
        optionsSource: 'units',
        labelKey: 'name',
        valueKey: 'id',
        helper: 'Piece, box, kg, etc.',
      },
      {
        name: 'note',
        label: 'Additional Notes',
        type: 'textarea',
        placeholder: 'Extra details, variants, etc.',
      },
    ],
    transform: (values) => {
      const shouldAutoCode = values.barcodeMode === 'auto' || !values.code?.trim();
      const codeValue = shouldAutoCode ? `SKU-${Date.now()}` : values.code.trim();
      return {
        name: values.name,
        code: codeValue,
        price: Number(values.price) || 0,
        cost: 0,
        categoryId: values.categoryId || null,
        brandId: values.brandId || null,
        unitId: values.unitId || null,
        productUnit: 'Piece',
        saleUnit: 'Piece',
        purchaseUnit: 'Piece',
        barcodeSymbology: 'code128',
        hasVariants: false,
        stockAlert: 0,
        initialQuantity: 0,
        orderTax: 0,
        taxType: 'exclusive',
        note: values.note || undefined,
        photoData: values.productImage || undefined,
        barcodeFormat: 'code128',
      };
    },
  },
  'Label Template': {
    endpoint: '/label-templates',
    method: 'post',
    editMethod: 'put',
    successMessage: 'Template saved.',
    fields: [
      { name: 'name', label: 'Template Name', type: 'text', required: true },
      {
        name: 'size',
        label: 'Label Size',
        type: 'select',
        options: [
          { label: '2" x 2" (Small)', value: 'small' },
          { label: '3" x 3" (Medium)', value: 'medium' },
          { label: '4" x 6" (Large)', value: 'large' },
          { label: 'A7', value: 'A7' },
        ],
        default: 'medium',
      },
    ],
  },
  'Print Labels': {
    endpoint: '/label-templates/print',
    method: 'post',
    successMessage: 'Label generated.',
    responseType: 'blob',
    blobMimeType: 'application/pdf',
    handleBlob: 'openPdf',
    fields: [
      { name: 'templateId', label: 'Label Template', type: 'select', optionsSource: 'labelTemplates', labelKey: 'name' },
      { name: 'productId', label: 'Product', type: 'select', optionsSource: 'products', labelKey: 'name' },
      { name: 'quantity', label: 'Quantity', type: 'number', default: 1 },
    ],
  },
  'Import CSV': {
    endpoint: '/products/import',
    method: 'post',
    successMessage: 'Import queued.',
    fields: [
      {
        name: 'csv',
        label: 'CSV Data',
        type: 'textarea',
        required: true,
        placeholder: 'code,name,price\nSKU-001,Sample,29.99',
      },
    ],
  },
  'New Adjustment': {
    endpoint: '/adjustments',
    method: 'post',
    successMessage: 'Adjustment recorded.',
    fields: [
      { name: 'reference', label: 'Reference', type: 'text', required: true },
      {
        name: 'warehouseId',
        label: 'Warehouse',
        type: 'select',
        required: true,
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'warehouseId',
      },
      { name: 'notes', label: 'Note', type: 'textarea' },
    ],
    transform: (values) => ({
      ...values,
      date: new Date().toISOString(),
    }),
  },
  'New Transfer': {
    endpoint: '/transfers',
    method: 'post',
    successMessage: 'Transfer queued.',
    fields: [
      { name: 'reference', label: 'Reference', type: 'text', required: true },
      {
        name: 'fromWarehouseId',
        label: 'From Warehouse',
        type: 'select',
        required: true,
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'fromWarehouseId',
      },
      {
        name: 'toWarehouseId',
        label: 'To Warehouse',
        type: 'select',
        required: true,
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'toWarehouseId',
      },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    transform: (values) => ({
      ...values,
      status: 'pending',
      date: new Date().toISOString(),
    }),
  },
  'Log Expense': {
    endpoint: '/expenses',
    method: 'post',
    successMessage: 'Expense logged.',
    fields: [
      { name: 'reference', label: 'Reference', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      {
        name: 'categoryId',
        label: 'Expense Category',
        type: 'select',
        optionsSource: 'expenseCategories',
        labelKey: 'name',
        sourceKey: 'categoryId',
        required: true,
      },
      { name: 'details', label: 'Details', type: 'textarea' },
      {
        name: 'warehouseId',
        label: 'Warehouse',
        type: 'select',
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'warehouseId',
      },
    ],
    transform: (values) => ({
      ...values,
      date: new Date().toISOString(),
    }),
  },
  'Add Product Category': {
    endpoint: '/categories',
    method: 'post',
    successMessage: 'Category added.',
    fields: [
      { name: 'code', label: 'Code', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true },
    ],
  },
  'Add Expense Category': {
    endpoint: '/expense-categories',
    method: 'post',
    successMessage: 'Expense category added.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  'New Quotation': {
    endpoint: '/quotations',
    method: 'post',
    successMessage: 'Quotation created.',
    fields: [
      { name: 'reference', label: 'Reference', type: 'text', required: true },
      {
        name: 'customerId',
        label: 'Customer',
        type: 'select',
        optionsSource: 'customers',
        labelKey: 'name',
        sourceKey: 'customerId',
      },
      {
        name: 'warehouseId',
        label: 'Warehouse',
        type: 'select',
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'warehouseId',
      },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    transform: (values) => ({
      ...values,
      date: new Date().toISOString(),
      status: 'pending',
    }),
  },
  'New Sales Return': {
    endpoint: '/returns',
    method: 'post',
    successMessage: 'Sales return saved.',
    returnSource: 'sale',
    fields: [
      { name: 'reference', label: 'Reference', type: 'text', required: true },
      {
        name: 'customerId',
        label: 'Customer',
        type: 'select',
        optionsSource: 'customers',
        labelKey: 'name',
        sourceKey: 'customerId',
      },
      {
        name: 'warehouseId',
        label: 'Warehouse',
        type: 'select',
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'warehouseId',
      },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    transform: (values) => ({
      ...values,
      type: 'sale',
      status: 'pending',
      date: new Date().toISOString(),
      saleId: values.saleId || null,
      purchaseId: null,
      sourceReference: values.sourceReference || undefined,
      sourceTotal:
        values.sourceTotal !== undefined && values.sourceTotal !== ''
          ? Number(values.sourceTotal)
          : null,
    }),
  },
  'New Purchase Return': {
    endpoint: '/returns',
    method: 'post',
    successMessage: 'Purchase return saved.',
    returnSource: 'purchase',
    fields: [
      { name: 'reference', label: 'Reference', type: 'text', required: true },
      {
        name: 'supplierId',
        label: 'Supplier',
        type: 'select',
        optionsSource: 'suppliers',
        labelKey: 'name',
        sourceKey: 'supplierId',
      },
      {
        name: 'warehouseId',
        label: 'Warehouse',
        type: 'select',
        optionsSource: 'warehouses',
        labelKey: 'name',
        sourceKey: 'warehouseId',
      },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    transform: (values) => ({
      ...values,
      type: 'purchase',
      status: 'pending',
      date: new Date().toISOString(),
      saleId: null,
      purchaseId: values.purchaseId || null,
      sourceReference: values.sourceReference || undefined,
      sourceTotal:
        values.sourceTotal !== undefined && values.sourceTotal !== ''
          ? Number(values.sourceTotal)
          : null,
    }),
  },
  'Add Customer': {
    endpoint: '/customers',
    method: 'post',
    successMessage: 'Customer added.',
    fields: [
      { name: 'code', label: 'Customer Code', type: 'text', default: () => `CUST-${Date.now()}` },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'country', label: 'Country', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
    ],
  },
  'Add Supplier': {
    endpoint: '/suppliers',
    method: 'post',
    successMessage: 'Supplier added.',
    fields: [
      { name: 'code', label: 'Supplier Code', type: 'text', default: () => `SUP-${Date.now()}` },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'country', label: 'Country', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
    ],
  },
  'Invite User': {
    endpoint: '/users',
    method: 'post',
    successMessage: 'User invited.',
    fields: [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text' },
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        helper: 'Enter a new password or leave blank to keep current / auto-generate.',
      },
      {
        name: 'warehouseId',
        label: 'Assigned Warehouse',
        type: 'select',
        optionsSource: 'warehouses',
        labelKey: 'name',
        valueKey: 'id',
        helper: 'Limits operational access for this user.',
      },
      {
        name: 'telegramChatId',
        label: 'Telegram Chat ID',
        type: 'text',
        helper: 'Enter the chat ID obtained from Telegram for password resets.',
      },
      {
        name: 'roleId',
        label: 'Role',
        type: 'select',
        optionsSource: 'roles',
        labelKey: 'name',
        sourceKey: 'role.id',
      },
    ],
    transform: (values, context) => {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName || undefined,
        username: values.username,
        phone: values.phone || undefined,
        roleId: Number(values.roleId || 2),
        warehouseId: values.warehouseId ? Number(values.warehouseId) : null,
        telegramChatId: values.telegramChatId || undefined,
      };
      const trimmedPassword = values.password?.trim();
      if (trimmedPassword) {
        payload.password = trimmedPassword;
      } else if (!context?.record?.id) {
        payload.password = `Inv-${Date.now().toString().slice(-6)}`;
      }
      return payload;
    },
  },
  'Add Note': {
    endpoint: '/notes',
    method: 'post',
    successMessage: 'Note saved.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'content', label: 'Content', type: 'textarea', required: true },
      { name: 'pinned', label: 'Pinned', type: 'checkbox' },
    ],
    transform: (values) => ({
      ...values,
      pinned: Boolean(values.pinned),
    }),
  },
  'Edit Settings': {
    endpoint: '/settings',
    method: 'post',
    successMessage: 'Setting saved.',
    fields: [
      { name: 'key', label: 'Setting Key', type: 'text', required: true },
      { name: 'value', label: 'Value', type: 'text', required: true },
    ],
    transform: (values) => ({
      key: values.key,
      value: { value: values.value },
    }),
  },
  'Add Warehouse': {
    endpoint: '/warehouses',
    method: 'post',
    successMessage: 'Warehouse added.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', default: () => `WH-${Date.now()}` },
      {
        name: 'type',
        label: 'Location Type',
        type: 'select',
        options: [
          { label: 'Store (sales & stock)', value: 'store' },
          { label: 'Storage Warehouse', value: 'storage' },
        ],
        default: 'store',
      },
      { name: 'country', label: 'Country', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
    ],
  },
  'Add Brand': {
    endpoint: '/brands',
    method: 'post',
    successMessage: 'Brand added.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  'Add Currency': {
    endpoint: '/currencies',
    method: 'post',
    successMessage: 'Currency added.',
    fields: [
      { name: 'code', label: 'Code', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'symbol', label: 'Symbol', type: 'text', required: true },
    ],
  },
  'Add Unit': {
    endpoint: '/units',
    method: 'post',
    successMessage: 'Unit added.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'shortName', label: 'Short Name', type: 'text', required: true },
      { name: 'operator', label: 'Operator (* or /)', type: 'text', default: '*' },
      { name: 'operationValue', label: 'Operation Value', type: 'number', default: 1 },
    ],
  },
  'Add Role': {
    endpoint: '/roles',
    method: 'post',
    successMessage: 'Role created.',
    fields: [
      { name: 'name', label: 'Role Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  'Export Info': {
    download: {
      endpoint: '/exports/products',
      filename: 'export.csv',
    },
  },
  'Export CSV': {
    download: {},
  },
  'Export Sales Report': {
    download: {},
  },
};
