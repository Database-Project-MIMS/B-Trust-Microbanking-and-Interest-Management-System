import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
globalThis.React = React;
const { RecordActions } = await import('../../components/mims/record-actions.tsx');
const { RecordEditForm } = await import('../../components/mims/record-edit-form.tsx');
const { RecordPreview } = await import('../../components/mims/record-preview.tsx');
const { RecordListFilters } = await import('../../components/mims/record-list-filters.tsx');
const { TopBar } = await import('../../components/app-shell/top-bar.tsx');
const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
const navigation = Object.fromEntries(['AGENT', 'BRANCH_MANAGER', 'CUSTOMER'].map(roleName => [roleName,
  renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(PathnameContext.Provider, { value: '/dashboard' },
      React.createElement(TopBar, { session: { roleName, username: 'Synthetic user' } }))))]));
const { default: SavingsPlanClient } = await import('../../app/plans/SavingsPlanClient.tsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const plan = { planId: '11111111-1111-4111-8111-111111111111', planName: 'Joint', description: 'Synthetic plan',
  interestRate: '0.0700', minBalance: '5000.00', status: 'ACTIVE', minAgeYears: 18, maxAgeYears: null,
  minHolders: 2, maxHolders: 4, requiresAllAdult: true, createdAt: new Date('2026-01-01'), updatedAt: null };
process.stdout.write(JSON.stringify({
  navigation,
  filters: render(RecordListFilters, { resource: 'agents', searchLabel: 'Agent name', selectionLabel: 'Branch',
    options: [{ value: 'permitted', label: 'Permitted branch' }], statuses: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    value: { q: 'Draft query', status: 'ACTIVE', selection: '' }, onChange() {}, onSearch() {}, onClear() {} }),
  readOnly: render(RecordActions, { href: '/accounts/example', name: 'Savings account' }),
  editable: render(RecordActions, { href: '/customers/example', name: 'Synthetic Customer', canEdit: true }),
  form: render(RecordEditForm, { title: 'Edit customer', description: 'Contact only', endpoint: '/api/customers/example',
    onSaved() {}, onCancel() {}, fields: [{ name: 'fullName', label: 'Full name', value: 'Synthetic Customer', required: true, maxLength: 150 },
      { name: 'phone', label: 'Phone', value: '', nullable: true, type: 'tel' },
      { name: 'gender', label: 'Gender', value: 'FEMALE', options: [{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }] }] }),
  preview: render(RecordPreview, { title: 'Product', items: [{ label: 'Description', value: null }, { label: 'Snapshot rate', value: '13.75%' }] }),
  plan: render(SavingsPlanClient, { initialPlans: [plan], canEdit: false }),
}));
