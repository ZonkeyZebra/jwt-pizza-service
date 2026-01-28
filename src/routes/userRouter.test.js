const request = require('supertest');
const app = require('../service');

let adminAuthToken;
let admin;
const { Role, DB } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@adminTest.com';

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
    // make email unique per test run
    const testAdmin = createAdminUser();
    admin = await testAdmin

    // login admin user
    const loginRes = await request(app).put('/api/auth').send(admin);
    adminAuthToken = loginRes.body.token;
});

test('get user', async () => {
    const getUser = await request(app).get('/api/user/me').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(getUser.status).toBe(200);
});