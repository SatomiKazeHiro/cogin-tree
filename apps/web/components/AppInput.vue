<template>
  <div class="w-full">
    <label v-if="label" :for="inputId" class="mb-2 block text-[13px] font-[500] text-secondary">
      {{ label }}
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full rounded-[9.6px] border border-border bg-surface px-4 py-2.5 text-[15px] text-ink placeholder:text-placeholder focus:border-strong focus:outline-none disabled:opacity-60"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="mt-1.5 text-[13px] text-danger">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string;
  label?: string;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  type: 'text',
});

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const inputId = useId();
</script>
