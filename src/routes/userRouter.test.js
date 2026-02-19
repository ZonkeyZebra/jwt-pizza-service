const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let adminAuthToken;
let admin;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

function createTestUser() {
    return {
        name: randomName(),
        email: `${randomName()}@test.com`,
        password: 'a',
    };
}

async function createAdminUser() {
    let user = {
        name: randomName(),
        email: `${randomName()}@adminTest.com`,
        password: 'toomanysecrets',
        roles: [{ role: Role.Admin }],
    };

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
    admin = await createAdminUser();

    // login admin user
    const loginRes = await request(app)
        .put('/api/auth')
        .send(admin);

    adminAuthToken = loginRes.body.token;
});

test('get user', async () => {
    const getUser = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${adminAuthToken}`);

    expect(getUser.status).toBe(200);
});

test('update a user', async () => {
    // create a fresh user to update
    const testUser = createTestUser();
    const registerRes = await request(app)
        .post('/api/auth')
        .send(testUser);

    const testUserId = registerRes.body.user.id;

    const updatedInfo = {
        name: 'updated',
        email: `${randomName()}@updated.com`,
    };

    const updatedUser = await request(app)
        .put(`/api/user/${testUserId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(updatedInfo);

    expect(updatedUser.status).toBe(200);
});

test('list users unauthorized', async () => {
    const listUsersRes = await request(app).get('/api/user');
    expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
    const listUsersRes = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${adminAuthToken}`);

    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users).toBeDefined();
});

test('delete user', async () => {
    // create a fresh user to delete
    const testUser = createTestUser();
    const registerRes = await request(app)
        .post('/api/auth')
        .send(testUser);

    const testUserId = registerRes.body.user.id;

    const deleteRes = await request(app)
        .delete(`/api/user/${testUserId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

    expect(deleteRes.status).toBe(200);
});
