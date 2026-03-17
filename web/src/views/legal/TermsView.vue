<script setup>
const sections = [
  {
    title: 'Authorized Use',
    copy:
      'The Flow Bit Inventory Management System is provided exclusively to Flow Bit clients and their authorized staff. Accounts may not be shared outside your organization.',
  },
  {
    title: 'Data Responsibility',
    copy:
      'Users agree to maintain accurate inventory, financial, and customer data. Flow Bit reserves the right to log sessions and review activity when investigating fraud or misuse.',
  },
  {
    title: 'Confidentiality',
    copy:
      'Access to supplier pricing, warehouse locations, and stock positions is considered confidential. Exporting or distributing data outside your company requires prior approval.',
  },
  {
    title: 'System Updates',
    copy:
      'Flow Bit may ship updates, patches, or maintenance windows that temporarily affect availability. Notice will be provided for planned downtime whenever feasible.',
  },
];
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-12">
    <div class="mx-auto max-w-3xl space-y-6 rounded-3xl bg-white p-8 shadow">
      <header class="space-y-2 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Flow Bit</p>
        <h1 class="text-3xl font-semibold text-slate-900">Terms of Use</h1>
        <p class="text-sm text-slate-500">
          These terms describe how Flow Bit clients and their teams may use the Inventory Management System. Replace
          this placeholder copy with your legal team’s finalized agreement.
        </p>
      </header>
      <section class="space-y-5 text-sm text-slate-600">
        <article v-for="section in sections" :key="section.title" class="space-y-1">
          <h2 class="text-base font-semibold text-slate-800">{{ section.title }}</h2>
          <p>{{ section.copy }}</p>
        </article>
      </section>
      <footer class="text-center text-xs text-slate-400">
        Last updated {{ new Date().toLocaleDateString() }} · Flow Bit Inventory Management System
      </footer>
    </div>
  </main>
</template>
