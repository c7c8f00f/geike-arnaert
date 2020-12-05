export default class UserFriendlyError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
    }
}
