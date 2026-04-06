<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-2.5 px-2 py-1.5">
    <img src="/bookbook-fav-icon-1.png" alt="BookBook" class="size-7 rounded-md shrink-0" />
    <span v-if="!collapsed" class="font-semibold text-sm text-highlighted leading-tight">
      BOOKBOOK<br />
      <span class="text-xs font-normal text-dimmed">Business Dashboard</span>
    </span>
  </div>
</template>
