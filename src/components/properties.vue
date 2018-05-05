<template>
  <div>
    <div class="row" v-for="(value, key) in data" :key="key">
      <div class="col s6">
        <span class="prop prop-key"> {{ key }} </span>
      </div>
      <div class="col s6">
        <span class="prop prop-value"> {{ value }} </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'properties',
  props: {
    data: {
      type: Object,
      required: true
    }
  }
}
</script>

<style scoped>
.prop {
  word-wrap: break-word;
}
</style>
