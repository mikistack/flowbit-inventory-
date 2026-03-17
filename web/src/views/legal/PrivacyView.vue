<script setup>
const principles = [
  {
    title: 'Data We Store',
    copy:
      'Inventory quantities, transactions, supplier/customer profiles, and audit logs are stored in Flow Bit operated databases solely to power the platform.',
  },
  {
    title: 'How Data Is Used',
    copy:
      'We use your data to calculate inventory balances, generate reports, trigger alerts, and provide customer support. Flow Bit never sells customer data to third parties.',
  },
  {
    title: 'Your Controls',
    copy:
      'Administrators can export or delete records via in-app tools. Contact Flow Bit support to request data retention schedules or removal beyond what the UI exposes.',
  },
  {
    title: 'Security Practices',
    copy:
      'The system uses authenticated APIs, role-based permissions, and event logging. Flow Bit recommends enabling Telegram OTP resets and enforcing strong passwords.',
  },
];
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-12">
    <div class="mx-auto max-w-3xl space-y-6 rounded-3xl bg-white p-8 shadow">
      <header class="space-y-2 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Flow Bit</p>
        <h1 class="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
        <p class="text-sm text-slate-500">
          This placeholder policy explains how Flow Bit handles data inside the Inventory Management System. Replace it
          with the finalized legal policy before production rollout.
        </p>
      </header>
      <section class="space-y-5 text-sm text-slate-600">
        <article v-for="principle in principles" :key="principle.title" class="space-y-1">
          <h2 class="text-base font-semibold text-slate-800">{{ principle.title }}</h2>
          <p>{{ principle.copy }}</p>
        </article>
      </section>
      <footer class="text-center text-xs text-slate-400">
        Last updated {{ new Date().toLocaleDateString() }} · Flow Bit Inventory Management System
      </footer>
    </div>
  </main>
</template>
