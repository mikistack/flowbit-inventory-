<script setup>
import { ref, reactive } from 'vue';
import ProductScanner from '@/components/products/ProductScanner.vue';
import ProductCard from '@/components/products/ProductCard.vue';

const lastProduct = ref(null);
const message = reactive({ text: '' });

const handleDetected = (code) => {
  lastProduct.value = { name: `Scanned ${code}`, code };
  message.text = 'Product scanned. Use desktop to finalize or continue on purchases.';
};
</script>

<template>
  <section class="p-4 space-y-4">
    <div class="rounded-2xl bg-white p-4 space-y-2 shadow">
      <h1 class="text-lg font-semibold">Quick Scan</h1>
      <p class="text-sm text-slate-500">Use your mobile camera or scanner gun.</p>
      <ProductScanner @detected="handleDetected" />
      <p v-if="message.text" class="text-xs text-brand-600">{{ message.text }}</p>
      <ProductCard v-if="lastProduct" :product="lastProduct" />
    </div>
    <div class="grid gap-3">
      <router-link
        to="/sales"
        class="rounded-2xl bg-brand-600 text-white text-center py-3 font-semibold"
      >
        Go to Sales
      </router-link>
      <router-link
        to="/purchases"
        class="rounded-2xl border border-slate-200 text-center py-3 font-semibold"
      >
        Go to Purchases
      </router-link>
    </div>
  </section>
</template>
