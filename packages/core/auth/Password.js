/*
  TODO:
    - work out how (and when) to vaidate the username and password fields
    - allow a validateUser() hook to be provided in config
*/

class PasswordAuthStrategy {
  constructor(keystone, listKey, config) {
    this.keystone = keystone;
    this.listKey = listKey;
    this.config = {
      identityField: 'email',
      secretField: 'password',
      ...config,
    };
  }
  getList() {
    return this.keystone.lists[this.listKey];
  }
  async validate({ identity, secret }) {
    const list = this.getList();

    // Validate the config
    const { identityField, secretField } = this.config;
    const secretFieldInstance = list.fieldsByPath[secretField];

    // Ducktype the password field; it needs a comparison function
    if (
      typeof secretFieldInstance.compare !== 'function' ||
      secretFieldInstance.compare.length < 2
    ) {
      throw new Error(
        `Field type specified does not support required functionality.` +
          `The PasswordAuthStrategy for list '${
            this.listKey
          }' is using a secretField of '${secretField}'` +
          ` but field type does not provide the required compare() functionality.`
      );
    }

    // Match by identity
    const results = await list.adapter.find({ [identityField]: identity });
    if (results.length === 0) {
      const key = '[passwordAuth:noItemsIdentified]';
      const message = `${key} The ${identityField} provided didn't identify any ${list.plural}`;
      return { success: false, message };
    }
    if (results.length > 1) {
      const key = '[passwordAuth:multipleItemsIdentified]';
      const message = `${key} The ${identityField} provided identified ${results.length} ${list.plural}`;
      return { success: false, message };
    }

    // Verify the secret matches
    const item = results[0];
    const hash = item[secretField];
    const match = await secretFieldInstance.compare(secret, hash);

    if (!match) {
      const key = '[passwordAuth:secretMismatch]';
      const message = `${key} The ${secretField} provided is incorrect`;
      return { success: false, message };
    }

    return { success: true, list, item, message: 'Authentication successful' };
  }
}

PasswordAuthStrategy.authType = 'password';

module.exports = PasswordAuthStrategy;
