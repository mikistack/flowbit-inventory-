<script setup>
const props = defineProps({
  product: { type: Object, required: true },
});
</script>

<template>
  <div class="product-card">
    <div class="flex gap-3">
      <img
        v-if="product.images?.length"
        :src="product.images[0].url"
        alt="Product"
        class="h-16 w-16 rounded-xl object-cover border border-slate-200"
      />
      <div class="flex-1 text-sm">
        <p class="font-semibold text-slate-900">{{ product.name }}</p>
        <p class="text-slate-500">SKU: {{ product.code }}</p>
        <p class="text-slate-500">Price: {{ product.price }}</p>
      </div>
    </div>
    <img
      v-if="product.barcodeImageUrl"
      :src="product.barcodeImageUrl"
      alt="Barcode"
      class="mt-3 h-20 object-contain"
    />
  </div>
</template>

<style scoped>
.product-card {
  @apply rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2;
}
</style>
