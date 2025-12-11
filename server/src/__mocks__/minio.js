// Mock MinIO client for testing
class Client {
  constructor() {
    this.bucketExists = jest.fn();
    this.makeBucket = jest.fn();
    this.setBucketPolicy = jest.fn();
    this.putObject = jest.fn();
    this.removeObject = jest.fn();
    this.statObject = jest.fn();
    this.listBuckets = jest.fn();
  }
}

module.exports = { Client };
