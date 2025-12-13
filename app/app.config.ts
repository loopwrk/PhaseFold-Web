export default defineAppConfig({
  ui: {
    toast: {
      slots: {
        wrapper: "py-2",
        title: "text-xl",
        icon: "size-7 mt-2",
        close: "cursor-pointer mt-2.5",
      },
    },
    button: {
      slots: {
        base: "mr-4",
      },
    },
  },
});
