const mongoose = require("mongoose");

// Adds deletedAt/deletedBy and hides trashed docs from reads. Trash endpoints opt out with
// .setOptions({ withDeleted: true }). Lead has its own hooks (findOne must still see trashed leads).
module.exports = function softDelete(schema) {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  });
  schema.pre(
    ["find", "findOne", "countDocuments", "findOneAndUpdate"],
    function () {
      if (!this.getOptions().withDeleted) this.where({ deletedAt: null });
    },
  );
  schema.pre("aggregate", function () {
    if (!this.options.withDeleted)
      this.pipeline().unshift({ $match: { deletedAt: null } });
  });
};
