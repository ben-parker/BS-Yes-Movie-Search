<template>
    <div>
        <input type="text" class="autocomplete-input" 
            :placeholder="placeholder"
        >
        {{ test }}
    </div>
</template>

<script>
// import axios from 'axios';

export default {
    name: 'Autocomplete',
    props: ['placeholder'],
    data: () => ({
        test: 'Testing!',
    })
};
</script>
