<script setup>
defineProps({ size: { type: Number, default: 28 } })
</script>

<!-- Same geometry as scripts/make-icon.mjs, in a 0..100 space -->
<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" rx="22" style="fill: var(--logo-bg)" />
    <g stroke="#fff" stroke-width="11.6" stroke-linecap="round">
      <line x1="33" y1="24" x2="33" y2="76" />
      <line x1="33" y1="60" x2="60" y2="38" />
      <line x1="47" y1="48.6" x2="62" y2="76" />
    </g>
    <circle cx="75" cy="71" r="6.8" fill="#3355FF" />
  </svg>
</template>
