const request = require('supertest');
const app = require('../service');

let adminAuthToken;
let admin;
const testUser = { name: 'pizza diner user', email: 'reg@test.com', password: 'a' };
let testUserId;
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
    admin = await createAdminUser();

    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserId = registerRes.body.user.id;

    // login admin user
    const loginRes = await request(app).put('/api/auth').send(admin);
    adminAuthToken = loginRes.body.token;
});

test('get user', async () => {
    const getUser = await request(app).get('/api/user/me').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(getUser.status).toBe(200);
});

test('update a user', async () => {
    const updatedInfo = { name: 'updated', email: 'updated@test.com' }
    const updatedUser = await request(app).put(`/api/user/${testUserId}`).set('Authorization', `Bearer ${adminAuthToken}`).send(updatedInfo);
    expect(updatedUser.status).toBe(200);
});

test('list users unauthorized', async () => {
    const listUsersRes = await request(app).get('/api/user');
    expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
    const listUsersRes = await request(app).get('/api/user').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(Array.isArray(listUsersRes.body.users)).toBe(true);
    expect(listUsersRes.body.users.length).toBeGreaterThan(0);
});

test('delete user', async () => {
    const deleteRes = await request(app).delete(`/api/user/${testUserId}`).set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteRes.status).toBe(200);
});

test('delete user unauthorized', async () => {
    const deleteRes = await request(app).delete(`/api/user/${testUserId}`);
    expect(deleteRes.status).toBe(401);
});