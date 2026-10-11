import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
globalThis.React = React;
const { RecordActions } = await import('../../components/mims/record-actions.tsx');
const { RecordEditForm } = await import('../../components/mims/record-edit-form.tsx');
const { RecordPreview } = await import('../../components/mims/record-preview.tsx');
const { default: SavingsPlanClient } = await import('../../app/plans/SavingsPlanClient.tsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const plan = { planId: '11111111-1111-4111-8111-111111111111', planName: 'Joint', description: 'Synthetic plan',
  interestRate: '0.0700', minBalance: '5000.00', status: 'ACTIVE', minAgeYears: 18, maxAgeYears: null,
  minHolders: 2, maxHolders: 4, requiresAllAdult: true, createdAt: new Date('2026-01-01'), updatedAt: null };
process.stdout.write(JSON.stringify({
  readOnly: render(RecordActions, { href: '/accounts/example', name: 'Savings account' }),
  editable: render(RecordActions, { href: '/customers/example', name: 'Synthetic Customer', canEdit: true }),
  form: render(RecordEditForm, { title: 'Edit customer', description: 'Contact only', endpoint: '/api/customers/example',
    onSaved() {}, onCancel() {}, fields: [{ name: 'fullName', label: 'Full name', value: 'Synthetic Customer', required: true, maxLength: 150 },
      { name: 'phone', label: 'Phone', value: '', nullable: true, type: 'tel' },
      { name: 'gender', label: 'Gender', value: 'FEMALE', options: [{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }] }] }),
  preview: render(RecordPreview, { title: 'Product', items: [{ label: 'Description', value: null }, { label: 'Snapshot rate', value: '13.75%' }] }),
  plan: render(SavingsPlanClient, { initialPlans: [plan], canEdit: false }),
}));
