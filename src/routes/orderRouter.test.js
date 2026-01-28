const request = require('supertest');
const app = require('../service');

// let adminAuthToken;
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
    console.log(loginRes.body);
    // adminAuthToken = loginRes.body.token;
});

test('get menu', async () => {
    const menu = await request(app).get('/api/order/menu');
    expect(menu.status).toBe(200);
    expect(Array.isArray(menu.body)).toBe(true);
});