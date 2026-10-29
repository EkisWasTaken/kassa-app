<script setup>
import { computed } from 'vue'

const props = defineProps({ values: Array, color: String })
const d = computed(() => {
  const v = props.values, lo = Math.min(...v) * 0.98, hi = Math.max(...v) * 1.02 || 1
  return v.map((x, i) => (i ? 'L' : 'M') + (v.length > 1 ? i / (v.length - 1) * 120 : 60).toFixed(1) + ' ' + (18 - (x - lo) / (hi - lo || 1) * 16).toFixed(1)).join(' ')
})
</script>

<template>
  <svg aria-hidden="true" viewBox="0 0 120 20" preserveAspectRatio="none" style="width: 100%; height: 20px">
    <path :d="d" fill="none" :style="{ stroke: color }" stroke-width="2" vector-effect="non-scaling-stroke" />
  </svg>
</template>
